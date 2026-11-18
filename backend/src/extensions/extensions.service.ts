import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AuditAction, ExtensionStatus, Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { evaluateMilestones } from '../milestones/milestone-plan';
import { CreateExtensionDto, ExtensionDecisionDto } from './extensions.dto';
import {
  EXTENSION_RULES,
  OPEN_EXTENSION,
  canRequestExtension,
  coordinatorCanDecide,
  daysWaiting,
  isEscalated,
} from './extension.rules';

const READ_STAFF: UserRole[] = [UserRole.ADMIN, UserRole.COORDINATOR, UserRole.DIRECTOR, UserRole.REGISTRO];
const COORD: UserRole[] = [UserRole.ADMIN, UserRole.COORDINATOR];
const DAY_MS = 86_400_000;

const WORK_SELECT = {
  id: true, title: true, status: true,
  student: { select: { userId: true, user: { select: { firstName: true, lastName: true, email: true } } } },
  advisor: { select: { userId: true, user: { select: { firstName: true, lastName: true, email: true } } } },
} satisfies Prisma.ThesisWorkSelect;
type WorkInfo = Prisma.ThesisWorkGetPayload<{ select: typeof WORK_SELECT }>;

@Injectable()
export class ExtensionsService {
  private readonly logger = new Logger(ExtensionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  // ── Acceso ───────────────────────────────────────────────────────────────

  private async loadWork(thesisWorkId: string, userId: string, role: UserRole) {
    const work = await this.prisma.thesisWork.findUnique({ where: { id: thesisWorkId }, select: WORK_SELECT });
    if (!work) throw new NotFoundException('Trabajo de grado no encontrado');
    const isOwner = role === UserRole.STUDENT && work.student?.userId === userId;
    const isAdvisor = role === UserRole.ADVISOR && work.advisor?.userId === userId;
    if (!isOwner && !isAdvisor && !READ_STAFF.includes(role)) {
      throw new ForbiddenException('No tienes acceso a este trabajo');
    }
    return { work, isOwner, isAdvisor, isCoord: COORD.includes(role) };
  }

  private async loadRequest(id: string) {
    const ext = await this.prisma.extensionRequest.findUnique({ where: { id } });
    if (!ext) throw new NotFoundException('Solicitud de prórroga no encontrada');
    return ext;
  }

  // ── Lectura ──────────────────────────────────────────────────────────────

  async list(thesisWorkId: string, userId: string, role: UserRole) {
    const { work, isOwner, isAdvisor, isCoord } = await this.loadWork(thesisWorkId, userId, role);
    const items = await this.prisma.extensionRequest.findMany({
      where: { thesisWorkId },
      include: { document: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    const now = new Date();
    const hasOpen = items.some((i) => OPEN_EXTENSION.includes(i.status));
    const approvedDays = items
      .filter((i) => i.status === ExtensionStatus.APPROVED)
      .reduce((sum, i) => sum + (i.approvedDays ?? 0), 0);

    return {
      canRequest: isOwner && !hasOpen && canRequestExtension(work.status),
      requestBlockedReason: !isOwner ? null
        : hasOpen ? 'Ya tienes una solicitud en trámite'
        : !canRequestExtension(work.status) ? 'Las prórrogas se solicitan antes de la defensa' : null,
      approvedDays,
      rules: { minDays: EXTENSION_RULES.minDays, maxDays: EXTENSION_RULES.maxDays, minReason: EXTENSION_RULES.minReason },
      items: items.map((e) => ({
        id: e.id,
        days: e.days,
        approvedDays: e.approvedDays,
        reason: e.reason,
        status: e.status,
        document: e.document,
        advisorNote: e.advisorNote,
        advisorDecidedAt: e.advisorDecidedAt,
        coordinatorNote: e.coordinatorNote,
        coordinatorDecidedAt: e.coordinatorDecidedAt,
        createdAt: e.createdAt,
        escalated: isEscalated(e, now),
        waitingDays: OPEN_EXTENSION.includes(e.status)
          ? daysWaiting(e.status === ExtensionStatus.PENDING_COORDINATOR ? (e.advisorDecidedAt ?? e.createdAt) : e.createdAt, now)
          : null,
        can: {
          cancel: isOwner && OPEN_EXTENSION.includes(e.status),
          advisorDecide: isAdvisor && e.status === ExtensionStatus.PENDING_ADVISOR,
          coordinatorDecide: isCoord && coordinatorCanDecide(e, now),
        },
      })),
    };
  }

  /** Bandeja: lo que espera la decisión de quien consulta. */
  async pendingForMe(userId: string, role: UserRole) {
    const now = new Date();
    let where: Prisma.ExtensionRequestWhereInput;
    if (role === UserRole.ADVISOR) {
      where = { status: ExtensionStatus.PENDING_ADVISOR, thesisWork: { advisor: { userId } } };
    } else if (COORD.includes(role)) {
      where = {
        OR: [
          { status: ExtensionStatus.PENDING_COORDINATOR },
          { status: ExtensionStatus.PENDING_ADVISOR, createdAt: { lte: new Date(now.getTime() - EXTENSION_RULES.escalationDays * DAY_MS) } },
        ],
      };
    } else {
      return [];
    }
    const items = await this.prisma.extensionRequest.findMany({
      where,
      include: {
        thesisWork: {
          select: {
            id: true, title: true, updatedAt: true,
            student: { select: { user: { select: { firstName: true, lastName: true } } } },
            career: { select: { code: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    return items.map((e) => ({
      id: e.id,
      days: e.days,
      status: e.status,
      createdAt: e.createdAt,
      escalated: isEscalated(e, now),
      work: e.thesisWork,
    }));
  }

  // ── Estudiante ───────────────────────────────────────────────────────────

  async create(thesisWorkId: string, dto: CreateExtensionDto, userId: string, role: UserRole) {
    const { work, isOwner } = await this.loadWork(thesisWorkId, userId, role);
    if (!isOwner) throw new ForbiddenException('Solo el estudiante del trabajo puede solicitar una prórroga');
    if (!canRequestExtension(work.status)) {
      throw new BadRequestException('Las prórrogas se solicitan mientras el trabajo está activo y antes de la defensa');
    }
    const open = await this.prisma.extensionRequest.count({ where: { thesisWorkId, status: { in: OPEN_EXTENSION } } });
    if (open > 0) throw new BadRequestException('Ya tienes una solicitud de prórroga en trámite');
    if (dto.documentId) {
      const doc = await this.prisma.document.findFirst({ where: { id: dto.documentId, thesisWorkId } });
      if (!doc) throw new BadRequestException('El documento de respaldo no pertenece a este trabajo');
    }

    // Sin asesor asignado, la solicitud va directo a Coordinación.
    const status = work.advisor ? ExtensionStatus.PENDING_ADVISOR : ExtensionStatus.PENDING_COORDINATOR;
    const ext = await this.prisma.extensionRequest.create({
      data: {
        thesisWorkId, requestedById: userId, days: dto.days, reason: dto.reason.trim(),
        documentId: dto.documentId ?? null, status,
      },
    });
    await this.audit.log(userId, AuditAction.CREATE, 'ExtensionRequest', ext.id, null, { thesisWorkId, days: dto.days, status });

    const student = `${work.student?.user.firstName} ${work.student?.user.lastName}`.trim();
    if (work.advisor) {
      await this.notify(work.advisor.userId, 'Prórroga por avalar', `${student} solicitó ${dto.days} días de prórroga para "${work.title}".`, 'EXTENSION_REQUESTED', { thesisWorkId, extensionId: ext.id });
    } else {
      await this.notifyRole([UserRole.COORDINATOR], 'Prórroga por decidir', `${student} solicitó ${dto.days} días de prórroga para "${work.title}" (sin asesor asignado).`, 'EXTENSION_REQUESTED', { thesisWorkId, extensionId: ext.id });
    }
    return this.list(thesisWorkId, userId, role);
  }

  async cancel(id: string, userId: string, role: UserRole) {
    const ext = await this.loadRequest(id);
    const { isOwner } = await this.loadWork(ext.thesisWorkId, userId, role);
    if (!isOwner) throw new ForbiddenException('Solo el estudiante puede cancelar su solicitud');
    if (!OPEN_EXTENSION.includes(ext.status)) throw new BadRequestException('Esta solicitud ya fue decidida');
    await this.prisma.extensionRequest.update({ where: { id }, data: { status: ExtensionStatus.CANCELLED } });
    await this.audit.log(userId, AuditAction.UPDATE, 'ExtensionRequest', id, { status: ext.status }, { status: ExtensionStatus.CANCELLED });
    return this.list(ext.thesisWorkId, userId, role);
  }

  // ── Asesor: aval ─────────────────────────────────────────────────────────

  async advisorDecision(id: string, endorse: boolean, dto: ExtensionDecisionDto, userId: string, role: UserRole) {
    const ext = await this.loadRequest(id);
    const { work, isAdvisor } = await this.loadWork(ext.thesisWorkId, userId, role);
    if (!isAdvisor) throw new ForbiddenException('Solo el asesor asignado puede avalar la prórroga');
    if (ext.status !== ExtensionStatus.PENDING_ADVISOR) throw new BadRequestException('Esta solicitud no está esperando el aval del asesor');
    const note = dto.note?.trim() || null;
    if (!endorse && (!note || note.length < 10)) throw new BadRequestException('Explica al estudiante por qué no avalas la prórroga (mínimo 10 caracteres)');

    const status = endorse ? ExtensionStatus.PENDING_COORDINATOR : ExtensionStatus.REJECTED;
    await this.prisma.extensionRequest.update({
      where: { id },
      data: { status, advisorUserId: userId, advisorNote: note, advisorDecidedAt: new Date() },
    });
    await this.audit.log(userId, AuditAction.UPDATE, 'ExtensionRequest', id, { status: ext.status }, { status, advisorNote: note });

    const meta = { thesisWorkId: work.id, extensionId: id };
    if (endorse) {
      await this.notify(work.student!.userId, 'Prórroga avalada', `Tu asesor avaló la prórroga de ${ext.days} días. Ahora la revisa Coordinación.`, 'EXTENSION_ENDORSED', meta);
      await this.notifyRole([UserRole.COORDINATOR], 'Prórroga por decidir', `El asesor avaló ${ext.days} días de prórroga para "${work.title}".`, 'EXTENSION_ENDORSED', meta);
    } else {
      await this.notify(work.student!.userId, 'Prórroga no avalada', `Tu asesor no avaló la prórroga: ${note}`, 'EXTENSION_REJECTED', meta, true);
    }
    return this.list(ext.thesisWorkId, userId, role);
  }

  // ── Coordinación: decisión final ─────────────────────────────────────────

  async coordinatorDecision(id: string, approve: boolean, dto: ExtensionDecisionDto, userId: string, role: UserRole) {
    const ext = await this.loadRequest(id);
    const { work, isCoord } = await this.loadWork(ext.thesisWorkId, userId, role);
    if (!isCoord) throw new ForbiddenException('Solo Coordinación decide las prórrogas');
    if (!coordinatorCanDecide(ext)) {
      throw new BadRequestException(
        ext.status === ExtensionStatus.PENDING_ADVISOR
          ? `Espera el aval del asesor (o ${EXTENSION_RULES.escalationDays} días sin respuesta para decidir directamente)`
          : 'Esta solicitud ya fue decidida',
      );
    }
    const note = dto.note?.trim() || null;
    if (!approve && (!note || note.length < 10)) throw new BadRequestException('Explica el motivo del rechazo (mínimo 10 caracteres)');
    const approvedDays = approve ? (dto.approvedDays ?? ext.days) : null;
    const now = new Date();

    // Al aprobar: se corren las fechas meta de los hitos aún pendientes.
    let shifted = 0;
    const ops: Prisma.PrismaPromise<unknown>[] = [
      this.prisma.extensionRequest.update({
        where: { id },
        data: {
          status: approve ? ExtensionStatus.APPROVED : ExtensionStatus.REJECTED,
          approvedDays, coordinatorUserId: userId, coordinatorNote: note, coordinatorDecidedAt: now,
        },
      }),
    ];
    if (approve && approvedDays) {
      const milestones = await this.prisma.milestone.findMany({ where: { thesisWorkId: work.id } });
      const pending = evaluateMilestones(milestones, work.status, now).filter((e) => !e.done).map((e) => e.milestone);
      shifted = pending.length;
      for (const m of pending) {
        ops.push(this.prisma.milestone.update({
          where: { id: m.id },
          data: { dueDate: new Date(m.dueDate.getTime() + approvedDays * DAY_MS) },
        }));
      }
    }
    await this.prisma.$transaction(ops);
    await this.audit.log(userId, AuditAction.UPDATE, 'ExtensionRequest', id,
      { status: ext.status },
      { status: approve ? ExtensionStatus.APPROVED : ExtensionStatus.REJECTED, approvedDays, note, milestonesShifted: shifted },
    );

    const meta = { thesisWorkId: work.id, extensionId: id };
    if (approve) {
      const msg = `Coordinación aprobó ${approvedDays} días de prórroga para "${work.title}". Las fechas de tus hitos pendientes se corrieron.`;
      await this.notify(work.student!.userId, 'Prórroga aprobada', msg, 'EXTENSION_APPROVED', meta, true);
      if (work.advisor) await this.notify(work.advisor.userId, 'Prórroga aprobada', `Se aprobaron ${approvedDays} días de prórroga para "${work.title}".`, 'EXTENSION_APPROVED', meta);
      // La especificación pide notificar a Registro el nuevo cronograma.
      await this.notifyRole([UserRole.REGISTRO], 'Prórroga aprobada', `"${work.title}" (${work.student?.user.firstName} ${work.student?.user.lastName}): ${approvedDays} días de prórroga aprobados.`, 'EXTENSION_APPROVED', meta);
    } else {
      await this.notify(work.student!.userId, 'Prórroga rechazada', `Coordinación rechazó la prórroga: ${note}`, 'EXTENSION_REJECTED', meta, true);
    }
    return this.list(ext.thesisWorkId, userId, role);
  }

  // ── Escalamiento diario (8:10 a.m. RD) ───────────────────────────────────

  @Cron('10 8 * * *', { name: 'extension-escalation', timeZone: 'America/Santo_Domingo' })
  async scheduledEscalation() {
    try {
      const n = await this.runEscalation();
      if (n) this.logger.log(`Escalamientos de prórrogas enviados: ${n}`);
    } catch (err) {
      this.logger.error('Error en el escalamiento de prórrogas', err as any);
    }
  }

  async runEscalation(now = new Date()) {
    const open = await this.prisma.extensionRequest.findMany({
      where: { status: { in: OPEN_EXTENSION } },
      include: { thesisWork: { select: WORK_SELECT } },
    });
    let sent = 0;
    for (const e of open) {
      if (!isEscalated(e, now)) continue;
      const work = e.thesisWork as WorkInfo;
      const meta = { thesisWorkId: work.id, extensionId: e.id };
      if (e.status === ExtensionStatus.PENDING_ADVISOR) {
        const d = daysWaiting(e.createdAt, now);
        sent += await this.notifyRoleOnce([UserRole.COORDINATOR], 'EXTENSION_ESCALATED', e.id, now,
          'Prórroga sin aval del asesor', `"${work.title}" lleva ${d} días esperando el aval del asesor. Ya puedes decidirla directamente.`, meta);
        if (work.advisor) sent += await this.notifyOnce(work.advisor.userId, 'EXTENSION_REMINDER', e.id, now,
          'Prórroga pendiente de tu aval', `"${work.title}" lleva ${d} días esperando tu aval.`, meta);
      } else {
        const d = daysWaiting(e.advisorDecidedAt ?? e.createdAt, now);
        sent += await this.notifyRoleOnce([UserRole.COORDINATOR], 'EXTENSION_REMINDER', e.id, now,
          'Prórroga pendiente de decisión', `"${work.title}" lleva ${d} días esperando la decisión de Coordinación.`, meta);
      }
    }
    return sent;
  }

  // ── Avisos ───────────────────────────────────────────────────────────────

  private async notify(userId: string, title: string, message: string, type: string, metadata: object, email = false) {
    await this.notifications.sendInApp(userId, title, message, type, metadata);
    if (email) {
      const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true, firstName: true } });
      if (u) await this.notifications.sendEmail(u.email, `${title} – UNPHU`, `<p>Hola ${u.firstName},</p><p>${message}</p>`);
    }
  }

  private async notifyRole(roles: UserRole[], title: string, message: string, type: string, metadata: object) {
    const users = await this.prisma.user.findMany({ where: { role: { in: roles }, isActive: true }, select: { id: true } });
    for (const u of users) await this.notifications.sendInApp(u.id, title, message, type, metadata);
  }

  /** Un aviso por usuario, tipo y solicitud cada 3 días. */
  private async notifyOnce(userId: string, type: string, extensionId: string, now: Date, title: string, message: string, metadata: object) {
    const exists = await this.prisma.notification.findFirst({
      where: {
        userId, type, createdAt: { gte: new Date(now.getTime() - 3 * DAY_MS) },
        metadata: { path: ['extensionId'], equals: extensionId },
      },
      select: { id: true },
    });
    if (exists) return 0;
    await this.notifications.sendInApp(userId, title, message, type, metadata);
    return 1;
  }

  private async notifyRoleOnce(roles: UserRole[], type: string, extensionId: string, now: Date, title: string, message: string, metadata: object) {
    const users = await this.prisma.user.findMany({ where: { role: { in: roles }, isActive: true }, select: { id: true } });
    let n = 0;
    for (const u of users) n += await this.notifyOnce(u.id, type, extensionId, now, title, message, metadata);
    return n;
  }
}
