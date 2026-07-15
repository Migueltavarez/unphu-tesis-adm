import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSectionDto, UpdateSectionDto, SectionActionDto } from './dto/section.dto';
import { SectionStatus, UserRole } from '@prisma/client';

// Transiciones de estado válidas por actor
const VALID_TRANSITIONS: Record<string, { to: SectionStatus; roles: UserRole[] }[]> = {
  DRAFT: [
    { to: SectionStatus.IN_PROGRESS, roles: [UserRole.STUDENT, UserRole.ADVISOR, UserRole.COORDINATOR, UserRole.ADMIN] },
  ],
  IN_PROGRESS: [
    { to: SectionStatus.PENDING_REVIEW, roles: [UserRole.STUDENT] },
    { to: SectionStatus.DRAFT, roles: [UserRole.STUDENT] },
  ],
  PENDING_REVIEW: [
    { to: SectionStatus.APPROVED, roles: [UserRole.ADVISOR, UserRole.COORDINATOR, UserRole.ADMIN] },
    { to: SectionStatus.RETURNED, roles: [UserRole.ADVISOR, UserRole.COORDINATOR, UserRole.ADMIN] },
  ],
  RETURNED: [
    { to: SectionStatus.IN_PROGRESS, roles: [UserRole.STUDENT] },
  ],
  APPROVED: [
    { to: SectionStatus.IN_PROGRESS, roles: [UserRole.COORDINATOR, UserRole.ADMIN] },
    { to: SectionStatus.PUBLISHED, roles: [UserRole.COORDINATOR, UserRole.ADMIN] },
  ],
  BLOCKED: [
    { to: SectionStatus.IN_PROGRESS, roles: [UserRole.STUDENT, UserRole.ADVISOR, UserRole.COORDINATOR, UserRole.ADMIN] },
  ],
};

const INCLUDE_FULL = {
  blocks: { where: { isDeleted: false }, orderBy: { order: 'asc' as const } },
  comments: {
    where: { parentId: null },
    orderBy: { createdAt: 'desc' as const },
    include: { replies: { orderBy: { createdAt: 'asc' as const } } },
  },
  history: { orderBy: { createdAt: 'desc' as const }, take: 5 },
};

@Injectable()
export class SectionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async findByDocument(documentId: string) {
    return this.prisma.section.findMany({
      where: { documentId },
      orderBy: { order: 'asc' },
      include: {
        _count: { select: { blocks: true, comments: true } },
        history: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
  }

  async findOne(id: string) {
    const section = await this.prisma.section.findUnique({
      where: { id },
      include: INCLUDE_FULL,
    });
    if (!section) throw new NotFoundException('Sección no encontrada');
    return section;
  }

  async create(documentId: string, dto: CreateSectionDto, userId: string) {
    const doc = await this.prisma.thesisDocument.findUnique({ where: { id: documentId } });
    if (!doc) throw new NotFoundException('Documento no encontrado');

    // Calcular order si no se proporcionó
    let order = dto.order;
    if (order === undefined) {
      const last = await this.prisma.section.findFirst({
        where: { documentId },
        orderBy: { order: 'desc' },
      });
      order = (last?.order ?? 0) + 10;
    }

    const section = await this.prisma.section.create({
      data: {
        documentId,
        title: dto.title,
        type: dto.type ?? 'CUSTOM',
        parentId: dto.parentId,
        order,
        isRequired: dto.isRequired ?? false,
        minWords: dto.minWords,
        maxWords: dto.maxWords,
        status: SectionStatus.DRAFT,
      },
      include: INCLUDE_FULL,
    });

    await this.logEvent(section.id, 'SECTION', 'SECTION_CREATED', { title: dto.title }, userId);
    return section;
  }

  async update(id: string, dto: UpdateSectionDto, userId: string) {
    const section = await this.findOne(id);

    if (['APPROVED', 'PUBLISHED'].includes(section.status)) {
      throw new ForbiddenException('No se puede editar una sección aprobada o publicada');
    }

    return this.prisma.section.update({
      where: { id },
      data: {
        title: dto.title,
        order: dto.order,
        notes: dto.notes,
      },
      include: INCLUDE_FULL,
    });
  }

  async transition(id: string, toStatus: SectionStatus, dto: SectionActionDto, userId: string, role: UserRole) {
    const section = await this.findOne(id);
    const current = section.status as string;

    const allowed = VALID_TRANSITIONS[current]?.find(
      (t) => t.to === toStatus && t.roles.includes(role),
    );
    if (!allowed) {
      throw new BadRequestException(
        `Transición inválida de ${current} → ${toStatus} para el rol ${role}`,
      );
    }

    const updated = await this.prisma.section.update({
      where: { id },
      data: {
        status: toStatus,
        history: {
          create: {
            fromStatus: section.status,
            toStatus,
            changedById: userId,
            notes: dto.notes,
          },
        },
      },
      include: INCLUDE_FULL,
    });

    await this.logEvent(id, 'SECTION', 'SECTION_STATUS_CHANGED', {
      from: current,
      to: toStatus,
      notes: dto.notes,
    }, userId);

    this.eventEmitter.emit('section.status_changed', {
      sectionId: id,
      fromStatus: current,
      toStatus,
      userId,
      notes: dto.notes,
    });

    return updated;
  }

  async addComment(
    sectionId: string,
    content: string,
    authorId: string,
    authorName: string,
    blockId?: string,
    parentId?: string,
  ) {
    const section = await this.prisma.section.findUnique({ where: { id: sectionId } });
    if (!section) throw new NotFoundException('Sección no encontrada');

    return this.prisma.sectionComment.create({
      data: {
        sectionId,
        blockId,
        parentId,
        authorId,
        authorName,
        content,
      },
      include: { replies: true },
    });
  }

  async resolveComment(commentId: string, userId: string) {
    const comment = await this.prisma.sectionComment.findUnique({ where: { id: commentId } });
    if (!comment) throw new NotFoundException('Comentario no encontrado');

    return this.prisma.sectionComment.update({
      where: { id: commentId },
      data: { resolved: true, resolvedAt: new Date(), resolvedBy: userId },
    });
  }

  async reorder(items: { id: string; order: number }[]) {
    await Promise.all(
      items.map((item) =>
        this.prisma.section.update({ where: { id: item.id }, data: { order: item.order } }),
      ),
    );
    return { success: true };
  }

  private async logEvent(
    aggregateId: string,
    aggregateType: string,
    eventType: string,
    payload: object,
    userId: string,
  ) {
    await this.prisma.docEvent.create({
      data: { aggregateId, aggregateType, eventType, payload, userId },
    });
  }
}
