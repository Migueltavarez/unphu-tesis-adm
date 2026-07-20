import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAdvanceDto, CreateAdvanceCommentDto, ReviewAdvanceDto } from './dto/advance.dto';
import { AdvanceStatus, ThesisStatus, UserRole } from '@prisma/client';

@Injectable()
export class AdvancesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(thesisWorkId: string, dto: CreateAdvanceDto, studentUserId: string, fileUrl?: string, fileName?: string) {
    const lastAdvance = await this.prisma.advance.findFirst({
      where: { thesisWorkId },
      orderBy: { version: 'desc' },
    });

    const version = lastAdvance ? lastAdvance.version + 1 : 1;

    const advance = await this.prisma.advance.create({
      data: {
        thesisWorkId,
        version,
        title: dto.title,
        description: dto.description,
        fileUrl,
        fileName,
        status: AdvanceStatus.SUBMITTED,
      },
      include: { comments: true },
    });

    await this.advanceThesisStatus(
      thesisWorkId,
      [ThesisStatus.IN_DEVELOPMENT, ThesisStatus.ADVISOR_FEEDBACK],
      ThesisStatus.ADVANCES_SUBMITTED,
      studentUserId,
      `Avance enviado: ${dto.title}`,
    );

    this.eventEmitter.emit('advance.submitted', { advance });
    return advance;
  }

  async findByThesisWork(thesisWorkId: string) {
    return this.prisma.advance.findMany({
      where: { thesisWorkId },
      include: {
        comments: {
          include: { author: { select: { firstName: true, lastName: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { version: 'desc' },
    });
  }

  async findOne(id: string) {
    const advance = await this.prisma.advance.findUnique({
      where: { id },
      include: { comments: true, thesisWork: { include: { student: { include: { user: true } }, advisor: { include: { user: true } } } } },
    });
    if (!advance) throw new NotFoundException('Avance no encontrado');
    return advance;
  }

  async review(id: string, dto: ReviewAdvanceDto, reviewerId: string) {
    const advance = await this.findOne(id);

    const updated = await this.prisma.advance.update({
      where: { id },
      data: { status: dto.status, reviewedAt: new Date() },
      include: { comments: true },
    });

    if (dto.comment) {
      await this.addComment(id, { content: dto.comment }, reviewerId);
    }

    const approved = dto.status === AdvanceStatus.APPROVED;
    await this.advanceThesisStatus(
      advance.thesisWorkId,
      [ThesisStatus.ADVANCES_SUBMITTED],
      approved ? ThesisStatus.IN_DEVELOPMENT : ThesisStatus.ADVISOR_FEEDBACK,
      reviewerId,
      approved ? 'Avance aprobado por el asesor' : 'Asesor solicitó revisión del avance',
    );

    this.eventEmitter.emit('advance.reviewed', { advance: updated, status: dto.status });
    return updated;
  }

  // Transiciona el estado del trabajo solo si está en uno de los estados
  // esperados; evita corromper un estado no relacionado con el flujo de avances.
  private async advanceThesisStatus(
    thesisWorkId: string,
    fromAny: ThesisStatus[],
    to: ThesisStatus,
    changedById: string,
    notes: string,
  ) {
    const work = await this.prisma.thesisWork.findUnique({ where: { id: thesisWorkId } });
    if (!work || !fromAny.includes(work.status)) return;

    await this.prisma.$transaction([
      this.prisma.thesisWork.update({ where: { id: thesisWorkId }, data: { status: to } }),
      this.prisma.statusHistory.create({
        data: { thesisWorkId, fromStatus: work.status, toStatus: to, changedById, notes },
      }),
    ]);
  }

  async addComment(advanceId: string, dto: CreateAdvanceCommentDto, authorId: string) {
    const advance = await this.prisma.advance.findUnique({ where: { id: advanceId } });
    if (!advance) throw new NotFoundException('Avance no encontrado');

    return this.prisma.advanceComment.create({
      data: {
        advanceId,
        authorId,
        content: dto.content,
      },
    });
  }
}
