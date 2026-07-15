import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateThesisDocumentDto } from './dto/thesis-document.dto';
import { CitationStyle, SectionStatus, SectionType } from '@prisma/client';

const DEFAULT_SECTIONS = [
  { type: SectionType.TITLE_PAGE,         title: 'Portada',           order: 10,  isRequired: true  },
  { type: SectionType.TABLE_OF_CONTENTS,  title: 'Índice',            order: 20,  isRequired: true  },
  { type: SectionType.ABSTRACT,           title: 'Resumen',           order: 30,  isRequired: true,  minWords: 150, maxWords: 350 },
  { type: SectionType.ABSTRACT_EN,        title: 'Abstract',          order: 40,  isRequired: true,  minWords: 150, maxWords: 350 },
  { type: SectionType.INTRODUCTION,       title: 'Introducción',      order: 50,  isRequired: true,  minWords: 500 },
  { type: SectionType.LITERATURE_REVIEW,  title: 'Marco Teórico',     order: 60,  isRequired: true,  minWords: 2000 },
  { type: SectionType.METHODOLOGY,        title: 'Metodología',       order: 70,  isRequired: true,  minWords: 1000 },
  { type: SectionType.RESULTS,            title: 'Resultados',        order: 80,  isRequired: true,  minWords: 1500 },
  { type: SectionType.DISCUSSION,         title: 'Discusión',         order: 90,  isRequired: false, minWords: 800  },
  { type: SectionType.CONCLUSIONS,        title: 'Conclusiones',      order: 100, isRequired: true,  minWords: 500 },
  { type: SectionType.RECOMMENDATIONS,    title: 'Recomendaciones',   order: 110, isRequired: false  },
  { type: SectionType.REFERENCES,         title: 'Referencias',       order: 120, isRequired: true  },
  { type: SectionType.APPENDIX,           title: 'Anexos',            order: 130, isRequired: false  },
];

@Injectable()
export class ThesisDocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  async findOrCreate(thesisWorkId: string, userId: string) {
    const existing = await this.prisma.thesisDocument.findUnique({
      where: { thesisWorkId },
      include: {
        sections: {
          orderBy: { order: 'asc' },
          include: {
            blocks: { where: { isDeleted: false }, orderBy: { order: 'asc' } },
            comments: { where: { resolved: false }, orderBy: { createdAt: 'desc' } },
            history: { orderBy: { createdAt: 'desc' }, take: 1 },
          },
        },
      },
    });

    if (existing) return existing;

    const thesisWork = await this.prisma.thesisWork.findUnique({
      where: { id: thesisWorkId },
      include: { student: { select: { careerId: true } } },
    });
    if (!thesisWork) throw new NotFoundException('Trabajo de grado no encontrado');

    // Use career's default template if one exists
    let sectionsToCreate: { type: any; title: string; order: number; isRequired: boolean; minWords?: number; maxWords?: number }[] = DEFAULT_SECTIONS;
    const careerId = thesisWork.student?.careerId;
    if (careerId) {
      const template = await this.prisma.documentTemplate.findFirst({
        where: { careerId, isDefault: true, isActive: true },
        include: { sections: { orderBy: { order: 'asc' } } },
      });
      if (template && template.sections.length > 0) {
        sectionsToCreate = template.sections.map((s) => ({
          type: s.type,
          title: s.title,
          order: s.order,
          isRequired: s.isRequired,
          minWords: s.minWords ?? undefined,
          maxWords: s.maxWords ?? undefined,
        }));
      }
    }

    return this.prisma.thesisDocument.create({
      data: {
        thesisWorkId,
        title: thesisWork.title,
        citationStyle: CitationStyle.APA7,
        sections: {
          create: sectionsToCreate.map((s) => ({
            ...s,
            status: SectionStatus.DRAFT,
          })),
        },
      },
      include: {
        sections: {
          orderBy: { order: 'asc' },
          include: {
            blocks: { where: { isDeleted: false }, orderBy: { order: 'asc' } },
            comments: { where: { resolved: false }, orderBy: { createdAt: 'desc' } },
            history: { orderBy: { createdAt: 'desc' }, take: 1 },
          },
        },
      },
    });
  }

  async findByThesisWork(thesisWorkId: string) {
    const doc = await this.prisma.thesisDocument.findUnique({
      where: { thesisWorkId },
      include: {
        sections: {
          orderBy: { order: 'asc' },
          include: {
            _count: { select: { blocks: true, comments: true } },
            history: { orderBy: { createdAt: 'desc' }, take: 1 },
          },
        },
      },
    });
    if (!doc) throw new NotFoundException('Documento no encontrado');
    return doc;
  }

  async getStats(thesisWorkId: string) {
    const doc = await this.prisma.thesisDocument.findUnique({
      where: { thesisWorkId },
      include: { sections: { select: { status: true, isRequired: true } } },
    });
    if (!doc) return null;

    const total = doc.sections.length;
    const required = doc.sections.filter((s) => s.isRequired).length;
    const byStatus: Record<string, number> = {};
    for (const s of doc.sections) {
      byStatus[s.status] = (byStatus[s.status] ?? 0) + 1;
    }
    const approved = byStatus['APPROVED'] ?? 0;
    const progress = required > 0 ? Math.round((approved / required) * 100) : 0;

    return { total, required, approved, progress, byStatus };
  }
}
