import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBlockDto, UpdateBlockDto, SaveVersionDto } from './dto/block.dto';
import { BlockType } from '@prisma/client';

@Injectable()
export class BlocksService {
  constructor(private readonly prisma: PrismaService) {}

  async findByNode(nodeId: string) {
    return this.prisma.block.findMany({
      where: { nodeId, isDeleted: false },
      orderBy: { order: 'asc' },
      include: { versions: { orderBy: { versionNum: 'desc' }, take: 1 } },
    });
  }

  async findOne(id: string) {
    const block = await this.prisma.block.findUnique({
      where: { id },
      include: { versions: { orderBy: { versionNum: 'desc' }, take: 5 } },
    });
    if (!block || block.isDeleted) throw new NotFoundException('Bloque no encontrado');
    return block;
  }

  async create(nodeId: string, dto: CreateBlockDto, authorId: string) {
    const node = await this.prisma.documentNode.findUnique({ where: { id: nodeId } });
    if (!node) throw new NotFoundException('Nodo no encontrado');

    if (['APPROVED', 'PUBLISHED'].includes(node.status)) {
      throw new ForbiddenException('No se puede agregar bloques a un nodo aprobado o publicado');
    }

    let order = dto.order;
    if (order === undefined) {
      const last = await this.prisma.block.findFirst({
        where: { nodeId, isDeleted: false },
        orderBy: { order: 'desc' },
      });
      order = (last?.order ?? 0) + 10;
    }

    const block = await this.prisma.block.create({
      data: {
        nodeId,
        type: dto.type ?? BlockType.PARAGRAPH,
        order,
        content: dto.content,
        authorId,
        wordCount: dto.wordCount ?? 0,
      },
    });

    // Auto-promote node from DRAFT/RETURNED to IN_PROGRESS
    if (['DRAFT', 'RETURNED'].includes(node.status)) {
      await this.prisma.documentNode.update({
        where: { id: nodeId },
        data: { status: 'IN_PROGRESS' },
      });
    }

    await this.createVersion(block.id, block.content as any, block.wordCount, authorId, 'AUTO', 'Creación inicial');

    return block;
  }

  async update(id: string, dto: UpdateBlockDto, authorId: string) {
    const block = await this.findOne(id);
    const node = await this.prisma.documentNode.findUnique({ where: { id: block.nodeId } });

    if (node && ['APPROVED', 'PUBLISHED'].includes(node.status)) {
      throw new ForbiddenException('No se puede editar bloques en un nodo aprobado');
    }

    const updated = await this.prisma.block.update({
      where: { id },
      data: {
        content: dto.content ?? block.content,
        order: dto.order,
        wordCount: dto.wordCount ?? block.wordCount,
        metadata: dto.metadata,
      },
    });

    if (node && ['DRAFT', 'RETURNED'].includes(node.status)) {
      await this.prisma.documentNode.update({
        where: { id: block.nodeId },
        data: { status: 'IN_PROGRESS' },
      });
    }

    return updated;
  }

  async softDelete(id: string, userId: string) {
    const block = await this.findOne(id);
    const node = await this.prisma.documentNode.findUnique({ where: { id: block.nodeId } });

    if (node && ['APPROVED', 'PUBLISHED'].includes(node.status)) {
      throw new ForbiddenException('No se puede eliminar bloques en un nodo aprobado');
    }

    await this.createVersion(id, block.content as any, block.wordCount, userId, 'AUTO', 'Antes de eliminar');

    return this.prisma.block.update({ where: { id }, data: { isDeleted: true } });
  }

  async reorder(items: { id: string; order: number }[]) {
    await Promise.all(
      items.map((item) =>
        this.prisma.block.update({ where: { id: item.id }, data: { order: item.order } }),
      ),
    );
    return { success: true };
  }

  async listVersions(blockId: string) {
    return this.prisma.blockVersion.findMany({
      where: { blockId },
      orderBy: { versionNum: 'desc' },
    });
  }

  async saveVersion(blockId: string, dto: SaveVersionDto, authorId: string) {
    const block = await this.findOne(blockId);
    await this.createVersion(blockId, block.content as any, block.wordCount, authorId, 'MANUAL', dto.message);
    return this.listVersions(blockId);
  }

  async restoreVersion(blockId: string, versionNum: number, authorId: string) {
    const version = await this.prisma.blockVersion.findUnique({
      where: { blockId_versionNum: { blockId, versionNum } },
    });
    if (!version) throw new NotFoundException('Versión no encontrada');

    const block = await this.findOne(blockId);
    await this.createVersion(blockId, block.content as any, block.wordCount, authorId, 'AUTO', `Antes de restaurar a v${versionNum}`);

    return this.prisma.block.update({
      where: { id: blockId },
      data: { content: version.content as any, wordCount: version.wordCount },
    });
  }

  private async createVersion(
    blockId: string,
    content: Record<string, any>,
    wordCount: number,
    authorId: string,
    trigger: string,
    message?: string,
  ) {
    const last = await this.prisma.blockVersion.findFirst({
      where: { blockId },
      orderBy: { versionNum: 'desc' },
    });
    const versionNum = (last?.versionNum ?? 0) + 1;

    await this.prisma.blockVersion.create({
      data: { blockId, versionNum, content, wordCount, authorId, trigger, message },
    });
    return versionNum;
  }
}
