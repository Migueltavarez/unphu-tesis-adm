import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AuditAction, FeedbackSeverity, FeedbackStatus, Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { FeedbackItemInputDto } from './feedback.dto';
import { FeedbackAction, compareFeedback, nextFeedbackStatus, summarizeFeedback } from './feedback.rules';

const READ_STAFF: UserRole[] = [UserRole.ADMIN, UserRole.COORDINATOR, UserRole.DIRECTOR, UserRole.JURADO];

type Access = { isOwner: boolean; isAdvisor: boolean; canManage: boolean; studentUserId: string | null };

@Injectable()
export class FeedbackService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly events: EventEmitter2,
  ) {}

  // ── Acceso ───────────────────────────────────────────────────────────────
  // Leen: estudiante dueño, asesor asignado y staff académico.
  // Gestionan (crear, verificar, reabrir, eliminar): asesor asignado,
  // Coordinación y Admin. Resuelve: solo el estudiante dueño.

  private async access(thesisWorkId: string, userId: string, role: UserRole): Promise<Access> {
    const work = await this.prisma.thesisWork.findUnique({
      where: { id: thesisWorkId },
      select: { student: { select: { userId: true } }, advisor: { select: { userId: true } } },
    });
    if (!work) throw new NotFoundException('Trabajo de grado no encontrado');
    const isOwner = role === UserRole.STUDENT && work.student?.userId === userId;
    const isAdvisor = role === UserRole.ADVISOR && work.advisor?.userId === userId;
    if (!isOwner && !isAdvisor && !READ_STAFF.includes(role)) {
      throw new ForbiddenException('No tienes acceso a este trabajo');
    }
    const canManage = isAdvisor || role === UserRole.COORDINATOR || role === UserRole.ADMIN;
    return { isOwner, isAdvisor, canManage, studentUserId: work.student?.userId ?? null };
  }

  // ── Lectura ──────────────────────────────────────────────────────────────

  async list(thesisWorkId: string, userId: string, role: UserRole) {
    const acc = await this.access(thesisWorkId, userId, role);
    const items = await this.prisma.feedbackItem.findMany({
      where: { thesisWorkId },
      include: {
        author: { select: { firstName: true, lastName: true } },
        advance: { select: { id: true, version: true, title: true } },
      },
    });
    items.sort(compareFeedback);

    return {
      summary: summarizeFeedback(items),
      items: items.map((i) => ({
        id: i.id,
        category: i.category,
        severity: i.severity,
        text: i.text,
        location: i.location,
        status: i.status,
        studentNote: i.studentNote,
        advisorNote: i.advisorNote,
        reopenCount: i.reopenCount,
        createdAt: i.createdAt,
        resolvedAt: i.resolvedAt,
        verifiedAt: i.verifiedAt,
        author: i.author,
        advance: i.advance,
        canResolve: acc.isOwner && !!nextFeedbackStatus(i.status, 'resolve'),
        canVerify: acc.canManage && !!nextFeedbackStatus(i.status, 'verify'),
        canReopen: acc.canManage && !!nextFeedbackStatus(i.status, 'reopen'),
        canDelete: acc.canManage && i.status === FeedbackStatus.OPEN && i.reopenCount === 0 && !i.resolvedAt,
      })),
    };
  }

  /** Observaciones bloqueantes aún pendientes del estudiante. */
  countOpenBlocking(thesisWorkId: string) {
    return this.prisma.feedbackItem.count({
      where: { thesisWorkId, status: FeedbackStatus.OPEN, severity: FeedbackSeverity.BLOCKING },
    });
  }

  // ── Escritura ────────────────────────────────────────────────────────────

  /** Crea observaciones para un avance. Uso interno: el llamador ya validó el acceso. */
  async createItems(thesisWorkId: string, advanceId: string, items: FeedbackItemInputDto[], authorId: string) {
    if (!items.length) return 0;
    await this.prisma.feedbackItem.createMany({
      data: items.map((it) => ({
        thesisWorkId,
        advanceId,
        authorId,
        category: it.category,
        severity: it.severity,
        text: it.text.trim(),
        location: it.location?.trim() || null,
      })),
    });
    return items.length;
  }

  /** Agregar observaciones a un avance fuera de la revisión (p. ej. tras leerlo con calma). */
  async addToAdvance(thesisWorkId: string, advanceId: string, items: FeedbackItemInputDto[], userId: string, role: UserRole) {
    const acc = await this.access(thesisWorkId, userId, role);
    if (!acc.canManage) throw new ForbiddenException('Solo el asesor asignado o Coordinación pueden agregar observaciones');
    const advance = await this.prisma.advance.findFirst({ where: { id: advanceId, thesisWorkId }, select: { id: true, title: true } });
    if (!advance) throw new NotFoundException('Avance no encontrado');

    const count = await this.createItems(thesisWorkId, advanceId, items, userId);
    this.events.emit('feedback.added', { thesisWorkId, advanceTitle: advance.title, count });
    return this.list(thesisWorkId, userId, role);
  }

  /** Al aprobar un avance, lo que el estudiante marcó como resuelto queda verificado. */
  verifyAllResolved(thesisWorkId: string, verifierId: string) {
    return this.prisma.feedbackItem.updateMany({
      where: { thesisWorkId, status: FeedbackStatus.RESOLVED },
      data: { status: FeedbackStatus.VERIFIED, verifiedAt: new Date(), verifiedById: verifierId },
    });
  }

  async transition(id: string, action: FeedbackAction, note: string | undefined, userId: string, role: UserRole) {
    const item = await this.prisma.feedbackItem.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Observación no encontrada');
    const acc = await this.access(item.thesisWorkId, userId, role);

    if (action === 'resolve' && !acc.isOwner) {
      throw new ForbiddenException('Solo el estudiante del trabajo puede marcar observaciones como resueltas');
    }
    if (action !== 'resolve' && !acc.canManage) {
      throw new ForbiddenException('Solo el asesor asignado o Coordinación pueden verificar o reabrir observaciones');
    }
    const to = nextFeedbackStatus(item.status, action);
    if (!to) {
      const msg: Record<FeedbackAction, string> = {
        resolve: 'Esta observación ya fue marcada como resuelta',
        verify: 'Esta observación ya está verificada',
        reopen: 'Esta observación ya está abierta',
      };
      throw new BadRequestException(msg[action]);
    }

    const now = new Date();
    const data: Prisma.FeedbackItemUpdateInput = { status: to };
    if (action === 'resolve') Object.assign(data, { resolvedAt: now, studentNote: note?.trim() || null });
    if (action === 'verify') Object.assign(data, { verifiedAt: now, verifiedById: userId });
    if (action === 'reopen') {
      Object.assign(data, {
        advisorNote: note?.trim() || null,
        reopenCount: { increment: 1 },
        verifiedAt: null,
        verifiedById: null,
      });
    }

    await this.prisma.feedbackItem.update({ where: { id }, data });
    if (action === 'reopen' && acc.studentUserId) {
      this.events.emit('feedback.reopened', { item, note, studentUserId: acc.studentUserId });
    }
    return this.list(item.thesisWorkId, userId, role);
  }

  /** Eliminar: solo observaciones recién creadas (nunca atendidas), p. ej. por error. */
  async remove(id: string, userId: string, role: UserRole) {
    const item = await this.prisma.feedbackItem.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Observación no encontrada');
    const acc = await this.access(item.thesisWorkId, userId, role);
    if (!acc.canManage) throw new ForbiddenException('Solo el asesor asignado o Coordinación pueden eliminar observaciones');
    if (item.status !== FeedbackStatus.OPEN || item.reopenCount > 0 || item.resolvedAt) {
      throw new BadRequestException('Solo se pueden eliminar observaciones que el estudiante aún no ha atendido');
    }
    await this.prisma.feedbackItem.delete({ where: { id } });
    await this.audit.log(userId, AuditAction.DELETE, 'FeedbackItem', id, {
      thesisWorkId: item.thesisWorkId, text: item.text, severity: item.severity, category: item.category,
    });
    return this.list(item.thesisWorkId, userId, role);
  }
}
