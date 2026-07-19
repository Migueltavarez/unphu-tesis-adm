import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '@prisma/client';

const NODE_TREE_INCLUDE = (depth = 6): any => {
  if (depth <= 0) return {};
  return {
    children: {
      orderBy: { order: 'asc' as const },
      include: NODE_TREE_INCLUDE(depth - 1),
    },
  };
};

@Injectable()
export class TemplatesService {
  constructor(private prisma: PrismaService) {}

  async findAll(careerId?: string, docType?: string) {
    return this.prisma.documentTemplate.findMany({
      where: {
        isActive: true,
        ...(careerId ? { careerId } : {}),
        ...(docType ? { docType } : {}),
      },
      include: {
        nodes: {
          where: { parentId: null },
          orderBy: { order: 'asc' },
          include: NODE_TREE_INCLUDE(),
        },
        career: { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const template = await this.prisma.documentTemplate.findUnique({
      where: { id },
      include: {
        nodes: {
          where: { parentId: null },
          orderBy: { order: 'asc' },
          include: NODE_TREE_INCLUDE(),
        },
        career: { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    if (!template) throw new NotFoundException('Plantilla no encontrada');
    return template;
  }

  async create(dto: any, userId: string) {
    const { nodes = [], ...data } = dto;
    const template = await this.prisma.documentTemplate.create({
      data: { ...data, createdById: userId },
    });

    if (nodes.length > 0) {
      await this.buildNodeTree(template.id, nodes, undefined);
    }

    return this.findOne(template.id);
  }

  async update(id: string, dto: any, userId: string, userRole: UserRole) {
    const template = await this.prisma.documentTemplate.findUnique({ where: { id } });
    if (!template) throw new NotFoundException('Plantilla no encontrada');
    if (template.createdById !== userId && userRole !== UserRole.ADMIN) {
      throw new ForbiddenException('No tienes permiso para editar esta plantilla');
    }

    const { nodes, ...templateData } = dto;

    await this.prisma.documentTemplate.update({ where: { id }, data: templateData });

    if (nodes !== undefined) {
      await this.prisma.templateNode.deleteMany({ where: { templateId: id } });
      if (nodes.length > 0) {
        await this.buildNodeTree(id, nodes, undefined);
      }
    }

    return this.findOne(id);
  }

  async remove(id: string, userId: string, userRole: UserRole) {
    const template = await this.prisma.documentTemplate.findUnique({ where: { id } });
    if (!template) throw new NotFoundException('Plantilla no encontrada');
    if (template.createdById !== userId && userRole !== UserRole.ADMIN) {
      throw new ForbiddenException('No tienes permiso para eliminar esta plantilla');
    }
    return this.prisma.documentTemplate.update({ where: { id }, data: { isActive: false } });
  }

  async setDefault(id: string, careerId: string) {
    const target = await this.prisma.documentTemplate.findUnique({ where: { id } });
    if (!target) throw new NotFoundException('Plantilla no encontrada');
    // Only unset defaults for the same careerId + docType combination
    await this.prisma.documentTemplate.updateMany({
      where: { careerId, docType: target.docType, isDefault: true },
      data: { isDefault: false },
    });
    return this.prisma.documentTemplate.update({
      where: { id },
      data: { isDefault: true },
    });
  }

  async addNode(templateId: string, dto: any) {
    const maxOrder = await this.prisma.templateNode.aggregate({
      where: { templateId, parentId: dto.parentId ?? null },
      _max: { order: true },
    });
    return this.prisma.templateNode.create({
      data: {
        templateId,
        parentId: dto.parentId ?? null,
        name: dto.name,
        nodeType: dto.nodeType ?? 'section',
        order: dto.order ?? (maxOrder._max.order ?? 0) + 10,
        isRequired: dto.isRequired ?? false,
        isOptional: dto.isOptional ?? false,
        metadata: dto.metadata ?? null,
      },
    });
  }

  async updateNode(nodeId: string, dto: any) {
    return this.prisma.templateNode.update({
      where: { id: nodeId },
      data: dto,
    });
  }

  async removeNode(nodeId: string) {
    return this.prisma.templateNode.delete({ where: { id: nodeId } });
  }

  async reorderNodes(items: { id: string; order: number; parentId?: string | null }[]) {
    await Promise.all(
      items.map((item) =>
        this.prisma.templateNode.update({
          where: { id: item.id },
          data: {
            order: item.order,
            ...(item.parentId !== undefined && { parentId: item.parentId }),
          },
        }),
      ),
    );
    return { updated: items.length };
  }

  private async buildNodeTree(
    templateId: string,
    nodes: any[],
    parentId: string | undefined,
  ) {
    for (const n of nodes) {
      const created = await this.prisma.templateNode.create({
        data: {
          templateId,
          parentId: parentId ?? null,
          name: n.name,
          nodeType: n.nodeType ?? 'section',
          order: n.order ?? 0,
          isRequired: n.isRequired ?? false,
          isOptional: n.isOptional ?? false,
          metadata: n.metadata ?? null,
        },
      });
      if (n.children?.length) {
        await this.buildNodeTree(templateId, n.children, created.id);
      }
    }
  }
}
