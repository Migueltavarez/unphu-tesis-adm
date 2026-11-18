import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAdvanceDto, CreateAdvanceCommentDto, ReviewAdvanceDto } from './dto/advance.dto';
import { AdvanceStatus, ThesisStatus, UserRole } from '@prisma/client';

@Injectable()
export class AdvancesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(thesisWorkId: string, dto: CreateAdvanceDto, studentUserId: string, fileUrl?: string, fileName?: string) {
    // El estudiante solo puede enviar avances a su propio trabajo de grado.
    const work = await this.prisma.thesisWork.findUnique({
      where: { id: thesisWorkId },
      include: { student: { select: { userId: true } } },
    });
    if (!work) throw new NotFoundException('Trabajo de grado no encontrado');
    if (work.student?.userId !== studentUserId) {
      throw new ForbiddenException('No puedes enviar avances a un trabajo que no es tuyo');
    }

    const lastAdvance = await this.prisma.advance.findFirst({
      where: { thesisWorkId },
      orderBy: { version: 'desc' },
    });

    const version = lastAdvance ? lastAdvance.version + 1 : 1;

    const advance = await this.prisma.advance.create({
      data: {
        thesisWorkId,
        version,
        title: dto.title,
        description: dto.description,
        fileUrl,
        fileName,
        status: AdvanceStatus.SUBMITTED,
      },
      include: { comments: true },
    });

    await this.advanceThesisStatus(
      thesisWorkId,
      [ThesisStatus.IN_DEVELOPMENT, ThesisStatus.ADVISOR_FEEDBACK],
      ThesisStatus.ADVANCES_SUBMITTED,
      studentUserId,
      `Avance enviado: ${dto.title}`,
    );

    this.eventEmitter.emit('advance.submitted', { advance });
    return advance;
  }

  // ── Control de acceso ─────────────────────────────────────────────────
  // Leen: el estudiante dueño, el asesor asignado y el staff académico.
  // Revisan: el asesor asignado y Coordinación.
  private static readonly READ_STAFF: UserRole[] = [
    UserRole.ADMIN, UserRole.COORDINATOR, UserRole.DIRECTOR, UserRole.JURADO,
  ];

  private async assertAccess(thesisWorkId: string, userId: string, role: UserRole, mode: 'read' | 'review') {
    const work = await this.prisma.thesisWork.findUnique({
      where: { id: thesisWorkId },
      select: { id: true, student: { select: { userId: true } }, advisor: { select: { userId: true } } },
    });
    if (!work) throw new NotFoundException('Trabajo de grado no encontrado');
    const isAdvisor = role === UserRole.ADVISOR && work.advisor?.userId === userId;
    if (mode === 'review') {
      if (isAdvisor || role === UserRole.COORDINATOR || role === UserRole.ADMIN) return work;
      throw new ForbiddenException('Solo el asesor asignado o Coordinación pueden revisar este avance');
    }
    const isOwner = role === UserRole.STUDENT && work.student?.userId === userId;
    if (isOwner || isAdvisor || AdvancesService.READ_STAFF.includes(role)) return work;
    throw new ForbiddenException('No tienes acceso a este trabajo');
  }

  async findByThesisWork(thesisWorkId: string, userId: string, role: UserRole) {
    await this.assertAccess(thesisWorkId, userId, role, 'read');
    return this.prisma.advance.findMany({
      where: { thesisWorkId },
      include: {
        comments: {
          include: { author: { select: { firstName: true, lastName: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { version: 'desc' },
    });
  }

  /** Detalle de un avance. Nunca expone campos sensibles de User. */
  async findOne(id: string, thesisWorkId: string, userId: string, role: UserRole) {
    await this.assertAccess(thesisWorkId, userId, role, 'read');
    const advance = await this.prisma.advance.findFirst({
      where: { id, thesisWorkId },
      include: {
        comments: {
          include: { author: { select: { firstName: true, lastName: true } } },
          orderBy: { createdAt: 'asc' },
        },
        thesisWork: {
          select: {
            id: true, title: true, status: true,
            student: { select: { user: { select: { firstName: true, lastName: true } } } },
            advisor: { select: { user: { select: { firstName: true, lastName: true } } } },
          },
        },
      },
    });
    if (!advance) throw new NotFoundException('Avance no encontrado');
    return advance;
  }

  async review(id: string, thesisWorkId: string, dto: ReviewAdvanceDto, reviewerId: string, role: UserRole) {
    await this.assertAccess(thesisWorkId, reviewerId, role, 'review');
    const advance = await this.prisma.advance.findFirst({ where: { id, thesisWorkId } });
    if (!advance) throw new NotFoundException('Avance no encontrado');

    const updated = await this.prisma.advance.update({
      where: { id },
      data: { status: dto.status, reviewedAt: new Date() },
      include: { comments: true },
    });

    if (dto.comment) {
      // El revisor (asesor/coordinador) ya pasó el guard de rol del endpoint.
      await this.insertComment(id, dto.comment, reviewerId);
    }

    const approved = dto.status === AdvanceStatus.APPROVED;
    await this.advanceThesisStatus(
      advance.thesisWorkId,
      [ThesisStatus.ADVANCES_SUBMITTED],
      approved ? ThesisStatus.IN_DEVELOPMENT : ThesisStatus.ADVISOR_FEEDBACK,
      reviewerId,
      approved ? 'Avance aprobado por el asesor' : 'Asesor solicitó revisión del avance',
    );

    this.eventEmitter.emit('advance.reviewed', { advance: updated, status: dto.status });
    return updated;
  }

  // Transiciona el estado del trabajo solo si está en uno de los estados
  // esperados; evita corromper un estado no relacionado con el flujo de avances.
  private async advanceThesisStatus(
    thesisWorkId: string,
    fromAny: ThesisStatus[],
    to: ThesisStatus,
    changedById: string,
    notes: string,
  ) {
    const work = await this.prisma.thesisWork.findUnique({ where: { id: thesisWorkId } });
    if (!work || !fromAny.includes(work.status)) return;

    await this.prisma.$transaction([
      this.prisma.thesisWork.update({ where: { id: thesisWorkId }, data: { status: to } }),
      this.prisma.statusHistory.create({
        data: { thesisWorkId, fromStatus: work.status, toStatus: to, changedById, notes },
      }),
    ]);
  }

  async addComment(advanceId: string, dto: CreateAdvanceCommentDto, authorId: string, authorRole: UserRole) {
    const advance = await this.prisma.advance.findUnique({
      where: { id: advanceId },
      include: {
        thesisWork: {
          include: {
            student: { select: { userId: true } },
            advisor: { select: { userId: true } },
          },
        },
      },
    });
    if (!advance) throw new NotFoundException('Avance no encontrado');

    // Solo participan: el estudiante dueño, el asesor asignado o staff (coordinación/dirección/admin).
    const staffRoles: UserRole[] = [UserRole.COORDINATOR, UserRole.ADMIN, UserRole.DIRECTOR];
    const isOwnerStudent = advance.thesisWork.student?.userId === authorId;
    const isAssignedAdvisor = advance.thesisWork.advisor?.userId === authorId;
    if (!staffRoles.includes(authorRole) && !isOwnerStudent && !isAssignedAdvisor) {
      throw new ForbiddenException('No tienes acceso a este avance');
    }

    return this.insertComment(advanceId, dto.content, authorId);
  }

  private async insertComment(advanceId: string, content: string, authorId: string) {
    return this.prisma.advanceComment.create({
      data: { advanceId, authorId, content },
    });
  }
}
