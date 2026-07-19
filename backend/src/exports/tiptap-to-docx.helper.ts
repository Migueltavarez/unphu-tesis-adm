import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  AlignmentType, Table, TableRow, TableCell, BorderStyle,
  WidthType, ShadingType, convertInchesToTwip,
} from 'docx';

type TipTapNode = {
  type: string;
  attrs?: Record<string, any>;
  content?: TipTapNode[];
  marks?: { type: string; attrs?: Record<string, any> }[];
  text?: string;
};

function textRuns(node: TipTapNode): TextRun[] {
  if (!node.content) return [];
  return node.content.flatMap((child) => {
    if (child.type !== 'text') return textRuns(child);
    const marks = child.marks ?? [];
    const bold = marks.some((m) => m.type === 'bold');
    const italics = marks.some((m) => m.type === 'italic');
    const strike = marks.some((m) => m.type === 'strike');
    const code = marks.some((m) => m.type === 'code');
    return [new TextRun({ text: child.text ?? '', bold, italics, strike, font: code ? 'Courier New' : undefined })];
  });
}

function itemText(item: TipTapNode): string {
  const para = item.content?.[0];
  return (para?.content ?? []).map((c) => c.text ?? '').join('');
}

function nodeToDocx(node: TipTapNode): (Paragraph | Table)[] {
  switch (node.type) {
    case 'heading': {
      const level = node.attrs?.level ?? 1;
      const headingMap: Record<number, typeof HeadingLevel[keyof typeof HeadingLevel]> = {
        1: HeadingLevel.HEADING_1,
        2: HeadingLevel.HEADING_2,
        3: HeadingLevel.HEADING_3,
      };
      return [new Paragraph({
        text: node.content?.map((c) => c.text ?? '').join('') ?? '',
        heading: headingMap[level] ?? HeadingLevel.HEADING_1,
        spacing: { before: 240, after: 120 },
      })];
    }
    case 'paragraph': {
      const runs = textRuns(node);
      if (runs.length === 0) return [new Paragraph({ spacing: { after: 120 } })];
      return [new Paragraph({ children: runs, spacing: { after: 120 }, alignment: AlignmentType.JUSTIFIED })];
    }
    case 'blockquote': {
      const text = (node.content ?? []).flatMap((c) => c.content ?? []).map((c) => c.text ?? '').join('');
      return [new Paragraph({
        children: [new TextRun({ text, italics: true })],
        indent: { left: convertInchesToTwip(0.5) },
        border: { left: { color: 'AAAAAA', style: BorderStyle.THICK, size: 6 } },
        spacing: { after: 120 },
      })];
    }
    case 'bulletList':
      return (node.content ?? []).map((item) =>
        new Paragraph({
          children: [new TextRun(itemText(item))],
          bullet: { level: 0 },
          spacing: { after: 60 },
        })
      );
    case 'orderedList':
      return (node.content ?? []).map((item) =>
        new Paragraph({
          children: [new TextRun(itemText(item))],
          numbering: { reference: 'ordered-list', level: 0 },
          spacing: { after: 60 },
        })
      );
    case 'codeBlock': {
      const text = node.content?.map((c) => c.text ?? '').join('') ?? '';
      return text.split('\n').map((line) =>
        new Paragraph({
          children: [new TextRun({ text: line, font: 'Courier New', size: 18 })],
          shading: { type: ShadingType.SOLID, color: 'F3F4F6' },
          spacing: { after: 0 },
        })
      );
    }
    case 'horizontalRule':
      return [new Paragraph({
        border: { bottom: { color: 'CCCCCC', style: BorderStyle.SINGLE, size: 6 } },
        spacing: { before: 120, after: 120 },
      })];
    case 'table': {
      const rows = (node.content ?? []).map((row) => {
        const cells = (row.content ?? []).map((cell) => {
          const isHeader = cell.type === 'tableHeader';
          return new TableCell({
            children: (cell.content ?? []).flatMap((n) => nodeToDocx(n) as Paragraph[]),
            shading: isHeader ? { type: ShadingType.SOLID, color: 'F3F4F6' } : undefined,
          });
        });
        return new TableRow({ children: cells });
      });
      return [new Table({
        rows,
        width: { size: 100, type: WidthType.PERCENTAGE },
        margins: { top: 80, bottom: 80, left: 80, right: 80 },
      })];
    }
    default:
      if (node.content) return node.content.flatMap((c) => nodeToDocx(c));
      return [];
  }
}

export interface ThesisSection {
  title: string;
  order: number;
  depth?: number;
  content: TipTapNode | null;
}

export async function buildDocx(thesisTitle: string, sections: ThesisSection[]): Promise<Buffer> {
  const children: (Paragraph | Table)[] = [
    new Paragraph({
      children: [new TextRun({ text: 'UNIVERSIDAD NACIONAL PEDRO HENRÍQUEZ UREÑA', bold: true, size: 24 })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
    }),
    new Paragraph({
      children: [new TextRun({ text: 'Facultad de Ingeniería', size: 22 })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 480 },
    }),
    new Paragraph({
      children: [new TextRun({ text: thesisTitle, bold: true, size: 32 })],
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 960 },
    }),
    new Paragraph({ children: [new TextRun('')], pageBreakBefore: true }),
  ];

  for (const section of sections.sort((a, b) => a.order - b.order)) {
    if (!section.content) continue;

    children.push(new Paragraph({
      text: section.title,
      heading: HeadingLevel.HEADING_1,
      pageBreakBefore: true,
      spacing: { before: 0, after: 240 },
    }));

    const sectionNodes = section.content.type === 'doc'
      ? (section.content.content ?? [])
      : [section.content];

    for (const node of sectionNodes) {
      children.push(...nodeToDocx(node));
    }
  }

  const doc = new Document({
    numbering: {
      config: [{
        reference: 'ordered-list',
        levels: [{ level: 0, format: 'decimal' as any, text: '%1.', alignment: 'start' as any }],
      }],
    },
    styles: {
      default: {
        document: {
          run: { font: 'Times New Roman', size: 24 },
          paragraph: { spacing: { line: 480 } },
        },
      },
    },
    sections: [{
      properties: {
        page: {
          margin: {
            top: convertInchesToTwip(1),
            right: convertInchesToTwip(1),
            bottom: convertInchesToTwip(1),
            left: convertInchesToTwip(1.5),
          },
        },
      },
      children,
    }],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}
