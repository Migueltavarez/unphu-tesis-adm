import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { UserRole } from '@prisma/client';

@Injectable()
export class TemplatesService {
  constructor(private prisma: PrismaService) {}

  async findAll(careerId?: string) {
    return this.prisma.documentTemplate.findMany({
      where: {
        isActive: true,
        ...(careerId ? { careerId } : {}),
      },
      include: {
        sections: { orderBy: { order: 'asc' } },
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
        sections: { orderBy: { order: 'asc' } },
        career: { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    if (!template) throw new NotFoundException('Template not found');
    return template;
  }

  async create(dto: CreateTemplateDto, userId: string) {
    const { sections = [], ...templateData } = dto;
    return this.prisma.documentTemplate.create({
      data: {
        ...templateData,
        createdById: userId,
        sections: {
          create: sections.map((s, i) => ({ ...s, order: s.order ?? i })),
        },
      },
      include: {
        sections: { orderBy: { order: 'asc' } },
        career: { select: { id: true, name: true, code: true } },
      },
    });
  }

  async update(id: string, dto: UpdateTemplateDto, userId: string, userRole: UserRole) {
    const template = await this.prisma.documentTemplate.findUnique({ where: { id } });
    if (!template) throw new NotFoundException('Template not found');
    if (template.createdById !== userId && userRole !== UserRole.ADMIN) {
      throw new ForbiddenException('No tienes permiso para editar esta plantilla');
    }

    const { sections, ...templateData } = dto;

    if (sections !== undefined) {
      await this.prisma.templateSection.deleteMany({ where: { templateId: id } });
      await this.prisma.templateSection.createMany({
        data: sections.map((s, i) => ({ ...s, templateId: id, order: s.order ?? i })),
      });
    }

    return this.prisma.documentTemplate.update({
      where: { id },
      data: templateData,
      include: {
        sections: { orderBy: { order: 'asc' } },
        career: { select: { id: true, name: true, code: true } },
      },
    });
  }

  async remove(id: string, userId: string, userRole: UserRole) {
    const template = await this.prisma.documentTemplate.findUnique({ where: { id } });
    if (!template) throw new NotFoundException('Template not found');
    if (template.createdById !== userId && userRole !== UserRole.ADMIN) {
      throw new ForbiddenException('No tienes permiso para eliminar esta plantilla');
    }
    return this.prisma.documentTemplate.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async setDefault(id: string, careerId: string) {
    await this.prisma.documentTemplate.updateMany({
      where: { careerId, isDefault: true },
      data: { isDefault: false },
    });
    return this.prisma.documentTemplate.update({
      where: { id },
      data: { isDefault: true },
      include: { sections: { orderBy: { order: 'asc' } } },
    });
  }

  async getDefaultForCareer(careerId: string) {
    return this.prisma.documentTemplate.findFirst({
      where: { careerId, isDefault: true, isActive: true },
      include: { sections: { orderBy: { order: 'asc' } } },
    });
  }
}
