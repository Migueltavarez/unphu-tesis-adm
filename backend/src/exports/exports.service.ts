import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { buildDocx, ThesisSection } from './tiptap-to-docx.helper';

function flattenNodes(nodes: any[], depth = 0): ThesisSection[] {
  const result: ThesisSection[] = [];
  for (const n of nodes) {
    result.push({
      title: n.name,
      order: n.order,
      depth,
      content: n.blocks?.[0]?.content ?? null,
    });
    if (n.children?.length) {
      result.push(...flattenNodes(n.children, depth + 1));
    }
  }
  return result;
}

@Injectable()
export class ExportsService {
  constructor(private prisma: PrismaService) {}

  async exportDocx(
    thesisWorkId: string,
    userId: string,
    docType = 'THESIS',
  ): Promise<{ buffer: Buffer; filename: string }> {
    const work = await this.prisma.thesisWork.findFirst({
      where: { id: thesisWorkId, student: { userId } },
      select: { id: true, title: true },
    });
    if (!work) throw new NotFoundException('Trabajo no encontrado');

    const doc = await this.prisma.thesisDocument.findUnique({
      where: { thesisWorkId_docType: { thesisWorkId, docType } },
      include: {
        nodes: {
          where: { parentId: null },
          orderBy: { order: 'asc' },
          include: buildNodeInclude(4),
        },
      },
    });

    if (!doc) throw new NotFoundException('Documento no encontrado. Ábrelo primero desde el editor.');

    const sections = flattenNodes((doc as any).nodes);
    const buffer = await buildDocx(work.title, sections);
    const filename = `${work.title.replace(/[^a-z0-9]/gi, '_').substring(0, 50)}.docx`;

    return { buffer, filename };
  }
}

function buildNodeInclude(depth: number): any {
  if (depth <= 0) return {};
  return {
    blocks: { where: { isDeleted: false }, orderBy: { order: 'asc' }, take: 1 },
    children: {
      orderBy: { order: 'asc' as const },
      include: buildNodeInclude(depth - 1),
    },
  };
}
