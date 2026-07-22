import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CitationStyle, UserRole } from '@prisma/client';
import { assertThesisAccess } from '../common/access/thesis-access.util';

const DEFAULT_THESIS_NODES = [
  { name: 'Introducción',              nodeType: 'chapter', order: 10,  isRequired: true,  metadata: { minWords: 500 } },
  { name: 'Planteamiento del Problema', nodeType: 'chapter', order: 20,  isRequired: true,  metadata: { minWords: 800 } },
  { name: 'Marco Teórico',             nodeType: 'chapter', order: 30,  isRequired: true,  metadata: { minWords: 2000 } },
  { name: 'Marco Metodológico',        nodeType: 'chapter', order: 40,  isRequired: true,  metadata: { minWords: 1000 } },
  { name: 'Desarrollo del Proyecto',   nodeType: 'chapter', order: 50,  isRequired: true,  metadata: { minWords: 1500 } },
  { name: 'Resultados',                nodeType: 'chapter', order: 60,  isRequired: true,  metadata: { minWords: 1000 } },
  { name: 'Conclusiones',              nodeType: 'chapter', order: 70,  isRequired: true,  metadata: { minWords: 500 } },
  { name: 'Recomendaciones',           nodeType: 'chapter', order: 80,  isRequired: false },
  { name: 'Referencias',               nodeType: 'chapter', order: 90,  isRequired: true },
  { name: 'Anexos',                    nodeType: 'chapter', order: 100, isRequired: false },
];

const DEFAULT_ANTEPROYECTO_NODES = [
  { name: 'Introducción',               nodeType: 'section', order: 10,  isRequired: true },
  { name: 'Planteamiento del Problema', nodeType: 'section', order: 20,  isRequired: true },
  { name: 'Objetivos',                  nodeType: 'section', order: 30,  isRequired: true },
  { name: 'Justificación',              nodeType: 'section', order: 40,  isRequired: true },
  { name: 'Marco Teórico',              nodeType: 'section', order: 50,  isRequired: true },
  { name: 'Alcance',                    nodeType: 'section', order: 60,  isRequired: false },
  { name: 'Antecedentes',               nodeType: 'section', order: 70,  isRequired: false },
  { name: 'Cronograma',                 nodeType: 'section', order: 80,  isRequired: false },
  { name: 'Presupuesto',                nodeType: 'section', order: 90,  isRequired: false },
  { name: 'Referencias',                nodeType: 'section', order: 100, isRequired: true },
];

@Injectable()
export class ThesisDocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Carga el trabajo (con dueños) y verifica acceso; lanza 404/403 si aplica. */
  private async assertAccess(thesisWorkId: string, userId: string, userRole: UserRole) {
    const work = await this.prisma.thesisWork.findUnique({
      where: { id: thesisWorkId },
      include: { student: { select: { userId: true } }, advisor: { select: { userId: true } } },
    });
    if (!work) throw new NotFoundException('Trabajo de grado no encontrado');
    assertThesisAccess(work, userId, userRole);
    return work;
  }

  async findOrCreate(thesisWorkId: string, userId: string, userRole: UserRole, docType = 'THESIS') {
    await this.assertAccess(thesisWorkId, userId, userRole);

    const existing = await this.prisma.thesisDocument.findFirst({
      where: { thesisWorkId, docType },
      include: {
        nodes: {
          where: { parentId: null },
          orderBy: { order: 'asc' },
          include: this.buildNodeInclude(4),
        },
      },
    });
    if (existing) return existing;

    const work = await this.prisma.thesisWork.findUnique({
      where: { id: thesisWorkId },
    });
    if (!work) throw new NotFoundException('Trabajo de grado no encontrado');

    // Look for a career-specific template
    const template = await this.prisma.documentTemplate.findFirst({
      where: { careerId: work.careerId, isDefault: true, isActive: true, docType },
      include: {
        nodes: {
          where: { parentId: null },
          orderBy: { order: 'asc' },
          include: this.buildTemplateInclude(6),
        },
      },
    });

    const doc = await this.prisma.thesisDocument.create({
      data: {
        thesisWorkId,
        docType,
        title: docType === 'ANTEPROYECTO' ? `Anteproyecto — ${work.title}` : work.title,
        citationStyle: CitationStyle.APA7,
      },
    });

    const rootNodes: any[] = template
      ? template.nodes
      : docType === 'ANTEPROYECTO'
        ? DEFAULT_ANTEPROYECTO_NODES
        : DEFAULT_THESIS_NODES;

    await this.createNodesFromList(doc.id, rootNodes, undefined);

    return this.prisma.thesisDocument.findUnique({
      where: { id: doc.id },
      include: {
        nodes: {
          where: { parentId: null },
          orderBy: { order: 'asc' },
          include: this.buildNodeInclude(4),
        },
      },
    });
  }

  async findByThesisWork(thesisWorkId: string, userId: string, userRole: UserRole, docType?: string) {
    await this.assertAccess(thesisWorkId, userId, userRole);

    return this.prisma.thesisDocument.findMany({
      where: { thesisWorkId, ...(docType ? { docType } : {}) },
      include: {
        nodes: {
          where: { parentId: null },
          orderBy: { order: 'asc' },
          include: this.buildNodeInclude(4),
        },
      },
    });
  }

  async getStats(thesisWorkId: string, userId: string, userRole: UserRole, docType = 'THESIS') {
    await this.assertAccess(thesisWorkId, userId, userRole);

    const doc = await this.prisma.thesisDocument.findUnique({
      where: { thesisWorkId_docType: { thesisWorkId, docType } },
      include: { nodes: true },
    });
    if (!doc) return null;

    const nodes = doc.nodes;
    const total = nodes.length;
    const required = nodes.filter((n) => n.isRequired).length;
    const approved = nodes.filter((n) => n.status === 'APPROVED').length;
    const byStatus = nodes.reduce<Record<string, number>>((acc, n) => {
      acc[n.status] = (acc[n.status] ?? 0) + 1;
      return acc;
    }, {});
    const progress = required > 0 ? Math.round((approved / required) * 100) : 0;

    return { total, required, approved, byStatus, progress };
  }

  private async createNodesFromList(
    documentId: string,
    nodes: any[],
    parentId: string | undefined,
  ) {
    for (const n of nodes) {
      const created = await this.prisma.documentNode.create({
        data: {
          documentId,
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
        await this.createNodesFromList(documentId, n.children, created.id);
      }
    }
  }

  private buildNodeInclude(depth: number): any {
    if (depth <= 0) return {};
    return { children: { orderBy: { order: 'asc' as const }, include: this.buildNodeInclude(depth - 1) } };
  }

  private buildTemplateInclude(depth: number): any {
    if (depth <= 0) return {};
    return { children: { orderBy: { order: 'asc' as const }, include: this.buildTemplateInclude(depth - 1) } };
  }
}
