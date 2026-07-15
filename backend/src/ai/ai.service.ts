import { Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { PrismaService } from '../prisma/prisma.service';
import { Response } from 'express';

type AiAction = 'suggest' | 'improve' | 'summarize' | 'outline' | 'references';

const SECTION_PROMPTS: Record<AiAction, (sectionTitle: string, content: string) => string> = {
  suggest: (title, content) => `Eres un asesor académico experto en trabajos de grado universitarios.
El estudiante está escribiendo la sección "${title}" de su tesis.

Contenido actual:
${content || '(La sección está vacía)'}

Proporciona 3-5 sugerencias específicas y accionables para mejorar o completar esta sección.
Sé concreto, menciona qué falta, qué agregar o cómo mejorar la estructura.
Responde en español con formato de lista numerada.`,

  improve: (title, content) => `Eres un editor académico experto en trabajos de grado universitarios.
Reescribe y mejora el siguiente contenido de la sección "${title}" de una tesis universitaria.

Texto original:
${content || '(Sin contenido)'}

Mantén las ideas principales pero mejora:
- Claridad y precisión académica
- Coherencia y fluidez
- Vocabulario técnico apropiado
- Estructura de párrafos

Devuelve SOLO el texto mejorado, en español, sin explicaciones adicionales.`,

  summarize: (title, content) => `Genera un resumen conciso (máximo 150 palabras) del siguiente contenido
de la sección "${title}" de una tesis universitaria.

Contenido:
${content || '(Sin contenido)'}

El resumen debe capturar los puntos más importantes. Responde en español.`,

  outline: (title, _) => `Genera un esquema detallado para la sección "${title}" de una tesis universitaria
de Ingeniería en Sistemas Computacionales.

El esquema debe incluir:
- Los subsecciones principales con descripción de qué debe contener cada una
- Puntos clave a cubrir
- Extensión aproximada recomendada para cada parte

Responde en español con formato estructurado.`,

  references: (title, content) => `Basado en el contenido de la sección "${title}" de esta tesis:

${content || '(Sin contenido)'}

Sugiere 5 tipos de fuentes académicas relevantes que debería citar el estudiante.
Para cada tipo indica: tipo de fuente, por qué es relevante, y cómo encontrarla.
Formato APA 7ma edición. Responde en español.`,
};

// Convert TipTap JSON to plain text for AI processing
function tiptapToText(node: any): string {
  if (!node) return '';
  if (node.type === 'text') return node.text ?? '';
  if (node.content) return node.content.map(tiptapToText).join(node.type === 'paragraph' ? '\n' : '');
  return '';
}

@Injectable()
export class AiService {
  private client: Anthropic | null = null;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY');
    if (apiKey) {
      this.client = new Anthropic({ apiKey });
    }
  }

  async streamSectionAi(
    sectionId: string,
    action: AiAction,
    userId: string,
    res: Response,
  ) {
    const section = await this.prisma.section.findFirst({
      where: { id: sectionId },
      include: {
        blocks: { where: { isDeleted: false }, orderBy: { order: 'asc' }, take: 1 },
        document: { include: { thesisWork: true } },
      },
    });

    if (!section) throw new NotFoundException('Sección no encontrada');
    if (!this.client) {
      throw new ServiceUnavailableException('El asistente AI no está configurado. Contacta al administrador.');
    }

    const contentJson = section.blocks[0]?.content as any ?? null;
    const contentText = tiptapToText(contentJson).substring(0, 4000); // limit tokens
    const prompt = SECTION_PROMPTS[action]?.(section.title, contentText);

    if (!prompt) throw new NotFoundException(`Acción "${action}" no reconocida`);

    // Stream SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.flushHeaders();

    const stream = await this.client.messages.stream({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        res.write(`data: ${JSON.stringify({ text: chunk.delta.text })}\n\n`);
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  }
}
