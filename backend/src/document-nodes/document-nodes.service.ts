import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { NodeStatus, UserRole } from '@prisma/client';
import {
  CreateDocumentNodeDto,
  UpdateDocumentNodeDto,
  MoveNodeDto,
  AddCommentDto,
  TransitionDto,
  SaveNodeVersionDto,
} from './dto/document-node.dto';

type ValidTransition = { to: NodeStatus; roles: UserRole[] };

const VALID_TRANSITIONS: Record<string, ValidTransition[]> = {
  DRAFT: [
    { to: NodeStatus.IN_PROGRESS, roles: [UserRole.STUDENT, UserRole.ADVISOR, UserRole.COORDINATOR, UserRole.ADMIN] },
  ],
  IN_PROGRESS: [
    { to: NodeStatus.PENDING_REVIEW, roles: [UserRole.STUDENT] },
    { to: NodeStatus.DRAFT, roles: [UserRole.STUDENT, UserRole.COORDINATOR, UserRole.ADMIN] },
  ],
  PENDING_REVIEW: [
    { to: NodeStatus.APPROVED, roles: [UserRole.ADVISOR, UserRole.COORDINATOR, UserRole.ADMIN] },
    { to: NodeStatus.RETURNED, roles: [UserRole.ADVISOR, UserRole.COORDINATOR, UserRole.ADMIN] },
  ],
  RETURNED: [
    { to: NodeStatus.IN_PROGRESS, roles: [UserRole.STUDENT] },
  ],
  APPROVED: [
    { to: NodeStatus.IN_PROGRESS, roles: [UserRole.COORDINATOR, UserRole.ADMIN] },
    { to: NodeStatus.PUBLISHED, roles: [UserRole.COORDINATOR, UserRole.ADMIN] },
  ],
  BLOCKED: [
    { to: NodeStatus.IN_PROGRESS, roles: [UserRole.COORDINATOR, UserRole.ADMIN] },
  ],
};

const INCLUDE_FULL = {
  blocks: { where: { isDeleted: false }, orderBy: { order: 'asc' as const } },
  comments: {
    where: { parentId: null },
    orderBy: { createdAt: 'desc' as const },
    include: {
      replies: { orderBy: { createdAt: 'asc' as const } },
    },
  },
  history: {
    orderBy: { createdAt: 'desc' as const },
    take: 10,
  },
  children: {
    orderBy: { order: 'asc' as const },
    include: {
      children: {
        orderBy: { order: 'asc' as const },
        include: {
          children: { orderBy: { order: 'asc' as const } },
        },
      },
    },
  },
};

@Injectable()
export class DocumentNodesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  async findTree(documentId: string) {
    return this.prisma.documentNode.findMany({
      where: { documentId, parentId: null },
      orderBy: { order: 'asc' },
      include: this.buildDeepInclude(6),
    });
  }

  private buildDeepInclude(depth: number): any {
    if (depth <= 0) return { children: false };
    return {
      children: {
        orderBy: { order: 'asc' as const },
        include: this.buildDeepInclude(depth - 1),
      },
    };
  }

  async findOne(id: string) {
    const node = await this.prisma.documentNode.findUnique({
      where: { id },
      include: INCLUDE_FULL,
    });
    if (!node) throw new NotFoundException('Nodo no encontrado');
    return node;
  }

  async create(documentId: string, dto: CreateDocumentNodeDto, userId: string) {
    const doc = await this.prisma.thesisDocument.findUnique({ where: { id: documentId } });
    if (!doc) throw new NotFoundException('Documento no encontrado');

    if (dto.parentId) {
      const parent = await this.prisma.documentNode.findFirst({
        where: { id: dto.parentId, documentId },
      });
      if (!parent) throw new BadRequestException('Nodo padre no encontrado en este documento');
    }

    const maxOrder = await this.prisma.documentNode.aggregate({
      where: { documentId, parentId: dto.parentId ?? null },
      _max: { order: true },
    });

    return this.prisma.documentNode.create({
      data: {
        documentId,
        parentId: dto.parentId ?? null,
        name: dto.name,
        nodeType: dto.nodeType ?? 'section',
        order: dto.order ?? (maxOrder._max.order ?? 0) + 10,
        isRequired: dto.isRequired ?? false,
        isOptional: dto.isOptional ?? false,
        metadata: dto.metadata ?? undefined,
      },
      include: INCLUDE_FULL,
    });
  }

  async update(id: string, dto: UpdateDocumentNodeDto) {
    await this.assertExists(id);
    return this.prisma.documentNode.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.nodeType !== undefined && { nodeType: dto.nodeType }),
        ...(dto.isRequired !== undefined && { isRequired: dto.isRequired }),
        ...(dto.isOptional !== undefined && { isOptional: dto.isOptional }),
        ...(dto.metadata !== undefined && { metadata: dto.metadata }),
      },
      include: INCLUDE_FULL,
    });
  }

  async move(id: string, dto: MoveNodeDto) {
    const node = await this.assertExists(id);
    if (dto.parentId === id) throw new BadRequestException('Un nodo no puede ser su propio padre');
    return this.prisma.documentNode.update({
      where: { id },
      data: {
        parentId: dto.parentId ?? null,
        order: dto.order,
      },
    });
  }

  async remove(id: string) {
    await this.assertExists(id);
    return this.prisma.documentNode.delete({ where: { id } });
  }

  async reorder(items: { id: string; order: number }[]) {
    await Promise.all(
      items.map((item) =>
        this.prisma.documentNode.update({
          where: { id: item.id },
          data: { order: item.order },
        }),
      ),
    );
    return { updated: items.length };
  }

  async transition(
    id: string,
    toStatus: NodeStatus,
    userId: string,
    userRole: UserRole,
    notes?: string,
  ) {
    const node = await this.assertExists(id);
    const currentStatus = node.status as string;
    const allowed = VALID_TRANSITIONS[currentStatus] ?? [];
    const transition = allowed.find((t) => t.to === toStatus);

    if (!transition) {
      throw new BadRequestException(
        `Transición ${currentStatus} → ${toStatus} no permitida`,
      );
    }
    if (!transition.roles.includes(userRole)) {
      throw new ForbiddenException('No tienes permiso para esta transición');
    }

    const updated = await this.prisma.documentNode.update({
      where: { id },
      data: { status: toStatus },
      include: INCLUDE_FULL,
    });

    await this.prisma.nodeStatusHistory.create({
      data: {
        nodeId: id,
        fromStatus: node.status,
        toStatus,
        changedById: userId,
        notes: notes ?? null,
      },
    });

    this.events.emit('node.status_changed', {
      nodeId: id,
      documentId: node.documentId,
      fromStatus: node.status,
      toStatus,
      userId,
    });

    return updated;
  }

  async addComment(id: string, dto: AddCommentDto, userId: string, authorName: string) {
    await this.assertExists(id);
    return this.prisma.nodeComment.create({
      data: {
        nodeId: id,
        blockId: dto.blockId ?? null,
        parentId: dto.parentId ?? null,
        authorId: userId,
        authorName,
        content: dto.content,
        priority: dto.priority ?? 'NORMAL',
      },
      include: { replies: true },
    });
  }

  async resolveComment(commentId: string, userId: string) {
    const comment = await this.prisma.nodeComment.findUnique({ where: { id: commentId } });
    if (!comment) throw new NotFoundException('Comentario no encontrado');
    return this.prisma.nodeComment.update({
      where: { id: commentId },
      data: { resolved: true, resolvedAt: new Date(), resolvedBy: userId },
    });
  }

  async listVersions(nodeId: string) {
    await this.assertExists(nodeId);
    return this.prisma.nodeVersion.findMany({
      where: { nodeId },
      orderBy: { versionNum: 'desc' },
    });
  }

  async saveVersion(nodeId: string, dto: SaveNodeVersionDto, userId: string) {
    const node = await this.prisma.documentNode.findUnique({
      where: { id: nodeId },
      include: { blocks: { where: { isDeleted: false }, orderBy: { order: 'asc' } } },
    });
    if (!node) throw new NotFoundException('Nodo no encontrado');

    const last = await this.prisma.nodeVersion.findFirst({
      where: { nodeId },
      orderBy: { versionNum: 'desc' },
    });
    const versionNum = (last?.versionNum ?? 0) + 1;

    return this.prisma.nodeVersion.create({
      data: {
        nodeId,
        versionNum,
        label: dto.label ?? null,
        snapshot: {
          name: node.name,
          nodeType: node.nodeType,
          metadata: node.metadata,
          blocks: node.blocks,
        },
        createdById: userId,
      },
    });
  }

  private async assertExists(id: string) {
    const node = await this.prisma.documentNode.findUnique({ where: { id } });
    if (!node) throw new NotFoundException('Nodo no encontrado');
    return node;
  }
}
