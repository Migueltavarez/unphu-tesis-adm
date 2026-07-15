import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { buildDocx, ThesisSection } from './tiptap-to-docx.helper';

@Injectable()
export class ExportsService {
  constructor(private prisma: PrismaService) {}

  async exportDocx(thesisWorkId: string, userId: string): Promise<{ buffer: Buffer; filename: string }> {
    const work = await this.prisma.thesisWork.findFirst({
      where: { id: thesisWorkId, student: { userId } },
      select: { id: true, title: true },
    });
    if (!work) throw new NotFoundException('Trabajo no encontrado');

    const doc = await this.prisma.thesisDocument.findUnique({
      where: { thesisWorkId },
      include: {
        sections: {
          orderBy: { order: 'asc' },
          include: {
            blocks: {
              where: { isDeleted: false },
              orderBy: { order: 'asc' },
              take: 1,
            },
          },
        },
      },
    });

    if (!doc) throw new NotFoundException('Documento no encontrado. Ábrelo primero desde el editor.');

    const sections: ThesisSection[] = (doc as any).sections.map((s: any) => ({
      title: s.title,
      order: s.order,
      content: s.blocks[0]?.content ?? null,
    }));

    const buffer = await buildDocx(work.title, sections);
    const filename = `${work.title.replace(/[^a-z0-9]/gi, '_').substring(0, 50)}.docx`;

    return { buffer, filename };
  }
}
