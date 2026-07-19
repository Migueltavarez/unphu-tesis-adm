import { Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { PrismaService } from '../prisma/prisma.service';
import { Response } from 'express';

type AiAction = 'suggest' | 'improve' | 'summarize' | 'outline' | 'references';

const NODE_PROMPTS: Record<AiAction, (nodeName: string, content: string) => string> = {
  suggest: (name, content) => `Eres un asesor académico experto en trabajos de grado universitarios.
El estudiante está escribiendo el nodo "${name}" de su tesis.

Contenido actual:
${content || '(El nodo está vacío)'}

Proporciona 3-5 sugerencias específicas y accionables para mejorar o completar este contenido.
Sé concreto, menciona qué falta, qué agregar o cómo mejorar la estructura.
Responde en español con formato de lista numerada.`,

  improve: (name, content) => `Eres un editor académico experto en trabajos de grado universitarios.
Reescribe y mejora el siguiente contenido del nodo "${name}" de una tesis universitaria.

Texto original:
${content || '(Sin contenido)'}

Mantén las ideas principales pero mejora:
- Claridad y precisión académica
- Coherencia y fluidez
- Vocabulario técnico apropiado
- Estructura de párrafos

Devuelve SOLO el texto mejorado, en español, sin explicaciones adicionales.`,

  summarize: (name, content) => `Genera un resumen conciso (máximo 150 palabras) del siguiente contenido
del nodo "${name}" de una tesis universitaria.

Contenido:
${content || '(Sin contenido)'}

El resumen debe capturar los puntos más importantes. Responde en español.`,

  outline: (name, _) => `Genera un esquema detallado para el nodo "${name}" de una tesis universitaria.

El esquema debe incluir:
- Las subsecciones principales con descripción de qué debe contener cada una
- Puntos clave a cubrir
- Extensión aproximada recomendada para cada parte

Responde en español con formato estructurado.`,

  references: (name, content) => `Basado en el contenido del nodo "${name}" de esta tesis:

${content || '(Sin contenido)'}

Sugiere 5 tipos de fuentes académicas relevantes que debería citar el estudiante.
Para cada tipo indica: tipo de fuente, por qué es relevante, y cómo encontrarla.
Formato APA 7ma edición. Responde en español.`,
};

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

  async streamNodeAi(
    nodeId: string,
    action: AiAction,
    userId: string,
    res: Response,
  ) {
    const node = await this.prisma.documentNode.findFirst({
      where: { id: nodeId },
      include: {
        blocks: { where: { isDeleted: false }, orderBy: { order: 'asc' }, take: 1 },
        document: { include: { thesisWork: true } },
      },
    });

    if (!node) throw new NotFoundException('Nodo no encontrado');
    if (!this.client) {
      throw new ServiceUnavailableException(
        'El asistente AI no está configurado. Contacta al administrador.',
      );
    }

    const contentJson = node.blocks[0]?.content as any ?? null;
    const contentText = tiptapToText(contentJson).substring(0, 4000);
    const prompt = NODE_PROMPTS[action]?.(node.name, contentText);

    if (!prompt) throw new NotFoundException(`Acción "${action}" no reconocida`);

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
