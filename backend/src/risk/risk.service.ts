import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AdvanceStatus, Prisma, ThesisStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  CLOSED_STATUSES,
  REVIEW_STATUSES,
  RISK_RULES,
  RiskLevel,
  ThesisRisk,
  computeRisk,
  daysBetween,
  riskSeverity,
} from './risk.rules';
import { evaluateMilestones } from '../milestones/milestone-plan';

type WorkRef = { id: string; status: ThesisStatus; createdAt: Date };

const LEVEL_LABEL: Record<RiskLevel, string> = {
  GREEN: 'Al día',
  YELLOW: 'Atención',
  RED: 'En riesgo',
  BLACK: 'Vencida',
};

const PENDING_REVIEW: AdvanceStatus[] = [AdvanceStatus.SUBMITTED, AdvanceStatus.UNDER_REVIEW];
const maxDate = (...ds: (Date | null | undefined)[]) =>
  ds.reduce<Date | null>((acc, d) => (d && (!acc || d > acc) ? d : acc), null);

@Injectable()
export class RiskService {
  private readonly logger = new Logger(RiskService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  // ── Cálculo en lote ──────────────────────────────────────────────────────
  // Una consulta agrupada por fuente de actividad para todo el lote.

  async computeFor(works: WorkRef[], now = new Date()): Promise<Map<string, ThesisRisk | null>> {
    const result = new Map<string, ThesisRisk | null>();
    const open = works.filter((w) => !CLOSED_STATUSES.includes(w.status));
    works.filter((w) => CLOSED_STATUSES.includes(w.status)).forEach((w) => result.set(w.id, null));
    if (open.length === 0) return result;

    const ids = open.map((w) => w.id);
    const inIds = { thesisWorkId: { in: ids } };

    const [history, devStart, advances, pending, docs, meetings, pastMeetings, nextMeetings, nextPres, overduePres, editor, plans, milestones, milestoneDone] =
      await Promise.all([
        this.prisma.statusHistory.groupBy({ by: ['thesisWorkId'], where: inIds, _max: { createdAt: true } }),
        this.prisma.statusHistory.groupBy({
          by: ['thesisWorkId'],
          where: { ...inIds, toStatus: ThesisStatus.WORK_STARTED },
          _max: { createdAt: true },
        }),
        this.prisma.advance.groupBy({
          by: ['thesisWorkId'],
          where: inIds,
          _max: { updatedAt: true, submittedAt: true },
        }),
        this.prisma.advance.groupBy({
          by: ['thesisWorkId'],
          where: { ...inIds, status: { in: PENDING_REVIEW } },
          _min: { submittedAt: true },
        }),
        this.prisma.document.groupBy({ by: ['thesisWorkId'], where: inIds, _max: { createdAt: true } }),
        this.prisma.meeting.groupBy({ by: ['thesisWorkId'], where: inIds, _max: { updatedAt: true } }),
        this.prisma.meeting.groupBy({
          by: ['thesisWorkId'],
          where: { ...inIds, scheduledAt: { lte: now } },
          _max: { scheduledAt: true },
        }),
        this.prisma.meeting.groupBy({
          by: ['thesisWorkId'],
          where: { ...inIds, completed: false, scheduledAt: { gt: now } },
          _min: { scheduledAt: true },
        }),
        this.prisma.presentation.findMany({
          where: { ...inIds, completed: false, scheduledAt: { gt: now } },
          select: { thesisWorkId: true, scheduledAt: true },
        }),
        this.prisma.presentation.findMany({
          where: { ...inIds, completed: false, scheduledAt: { lte: now } },
          select: { thesisWorkId: true, scheduledAt: true },
        }),
        this.prisma.$queryRaw<{ id: string; last: Date | null }[]>(Prisma.sql`
          SELECT td."thesisWorkId" AS id, MAX(b."updatedAt") AS last
          FROM blocks b
          JOIN document_nodes n ON n.id = b."nodeId"
          JOIN thesis_documents td ON td.id = n."documentId"
          WHERE td."thesisWorkId" IN (${Prisma.join(ids)})
          GROUP BY td."thesisWorkId"`),
        this.prisma.thesisWork.findMany({
          where: { id: { in: ids } },
          select: { id: true, career: { select: { expectedMonths: true, maxMonths: true } } },
        }),
        this.prisma.milestone.findMany({
          where: { ...inIds, required: true },
          select: { thesisWorkId: true, name: true, order: true, dueDate: true, required: true, completesAtStatus: true, completedAt: true },
        }),
        this.prisma.milestone.groupBy({
          by: ['thesisWorkId'],
          where: { ...inIds, completedAt: { not: null } },
          _max: { completedAt: true },
        }),
      ]);

    const byId = <T extends { thesisWorkId: string }>(rows: T[]) =>
      new Map(rows.map((r) => [r.thesisWorkId, r]));
    const H = byId(history), DS = byId(devStart), A = byId(advances), P = byId(pending), D = byId(docs);
    const M = byId(meetings), PM = byId(pastMeetings), NM = byId(nextMeetings), NP = byId(nextPres), OP = byId(overduePres);
    const E = new Map(editor.map((r) => [r.id, r.last ? new Date(r.last) : null]));
    const PLAN = new Map(plans.map((p) => [p.id, p.career]));
    const MD = byId(milestoneDone);
    const MS = new Map<string, typeof milestones>();
    milestones.forEach((m) => MS.set(m.thesisWorkId, [...(MS.get(m.thesisWorkId) ?? []), m]));

    for (const w of open) {
      const adv = A.get(w.id)?._max;
      const lastActivityAt =
        maxDate(
          w.createdAt,
          H.get(w.id)?._max.createdAt,
          adv?.updatedAt,
          D.get(w.id)?._max.createdAt,
          M.get(w.id)?._max.updatedAt,
          PM.get(w.id)?._max.scheduledAt,
          E.get(w.id),
          MD.get(w.id)?._max.completedAt,
        ) ?? w.createdAt;

      const evaluated = evaluateMilestones(MS.get(w.id) ?? [], w.status, now);
      const overdue = evaluated.find((e) => e.state === 'OVERDUE');
      const dueSoon = evaluated.find((e) => e.state === 'DUE_SOON');

      result.set(
        w.id,
        computeRisk(
          {
            status: w.status,
            startedAt: w.createdAt,
            lastActivityAt: lastActivityAt > now ? now : lastActivityAt,
            oldestPendingReviewAt: P.get(w.id)?._min.submittedAt ?? null,
            lastAdvanceAt: adv?.submittedAt ?? null,
            developmentStartedAt: DS.get(w.id)?._max.createdAt ?? null,
            nextScheduledEventAt: maxDate(NM.get(w.id)?._min.scheduledAt, NP.get(w.id)?.scheduledAt),
            overduePresentationAt: OP.get(w.id)?.scheduledAt ?? null,
            expectedMonths: PLAN.get(w.id)?.expectedMonths,
            maxMonths: PLAN.get(w.id)?.maxMonths,
            overdueMilestone: overdue ? { name: overdue.milestone.name, days: -overdue.daysToDue } : null,
            dueSoonMilestone: dueSoon ? { name: dueSoon.milestone.name, days: dueSoon.daysToDue } : null,
          },
          now,
        ),
      );
    }
    return result;
  }

  /** Agrega `risk` a cada trabajo de la lista. */
  async attach<T extends WorkRef>(works: T[]): Promise<(T & { risk: ThesisRisk | null })[]> {
    const risks = await this.computeFor(works);
    return works.map((w) => ({ ...w, risk: risks.get(w.id) ?? null }));
  }

  async attachOne<T extends WorkRef>(work: T): Promise<T & { risk: ThesisRisk | null }> {
    const [withRisk] = await this.attach([work]);
    return withRisk;
  }

  // ── Resumen para paneles de coordinación y dirección ────────────────────

  async summary() {
    const works = await this.prisma.thesisWork.findMany({
      where: { status: { notIn: CLOSED_STATUSES } },
      select: {
        id: true, title: true, status: true, createdAt: true, updatedAt: true,
        student: { select: { user: { select: { firstName: true, lastName: true } } } },
        advisor: { select: { user: { select: { firstName: true, lastName: true } } } },
        career: { select: { code: true, name: true } },
      },
    });
    const withRisk = await this.attach(works);

    const counts: Record<RiskLevel, number> = { GREEN: 0, YELLOW: 0, RED: 0, BLACK: 0 };
    withRisk.forEach((w) => w.risk && counts[w.risk.level]++);

    const atRisk = withRisk
      .filter((w) => w.risk && w.risk.level !== 'GREEN')
      .sort(
        (a, b) =>
          riskSeverity(b.risk!.level) - riskSeverity(a.risk!.level) ||
          b.risk!.daysInactive - a.risk!.daysInactive,
      );

    return { total: withRisk.length, counts, atRisk };
  }

  // ── Alertas y recordatorios automáticos (diario, 8:00 a.m. RD) ──────────

  @Cron('0 8 * * *', { name: 'risk-alerts', timeZone: 'America/Santo_Domingo' })
  async scheduledAlerts() {
    try {
      const stats = await this.runAlerts();
      this.logger.log(`Alertas de seguimiento enviadas: ${JSON.stringify(stats)}`);
    } catch (err) {
      this.logger.error('Error en el job de alertas de seguimiento', err as any);
    }
  }

  async runAlerts(now = new Date()) {
    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';
    const works = await this.prisma.thesisWork.findMany({
      where: { status: { notIn: CLOSED_STATUSES } },
      select: {
        id: true, title: true, status: true, createdAt: true,
        student: { select: { user: { select: { id: true, firstName: true, email: true } } } },
        advisor: { select: { user: { select: { id: true, firstName: true, email: true } } } },
        advances: {
          where: { status: { in: PENDING_REVIEW } },
          select: { submittedAt: true },
          orderBy: { submittedAt: 'asc' },
          take: 1,
        },
      },
    });
    const risks = await this.computeFor(works, now);
    const stats = { riskAlerts: 0, reviewReminders: 0, digests: 0 };

    for (const w of works) {
      const risk = risks.get(w.id);
      const student = w.student?.user;
      const advisor = w.advisor?.user;

      // a) Alerta de riesgo a estudiante y asesor (amarillo, rojo o negro).
      if (risk && risk.level !== 'GREEN') {
        const why = risk.reasons[0];
        const recipients = [student, advisor].filter(Boolean) as { id: string; firstName: string; email: string }[];
        for (const u of recipients) {
          const sent = await this.notifyOnce(u.id, 'RISK_ALERT', w.id, risk.level, 7, now, {
            title: `Seguimiento: ${LEVEL_LABEL[risk.level]}`,
            message: `"${w.title}": ${why}.`,
          });
          if (sent) {
            stats.riskAlerts++;
            if (risk.level !== 'YELLOW') {
              await this.notifications.sendEmail(
                u.email,
                `⚠️ Trabajo de grado ${LEVEL_LABEL[risk.level].toLowerCase()} – UNPHU`,
                `<p>Hola ${u.firstName},</p><p>El trabajo <strong>"${w.title}"</strong> está marcado como
                <strong>${LEVEL_LABEL[risk.level]}</strong> en el seguimiento:</p>
                <ul>${risk.reasons.map((r) => `<li>${r}</li>`).join('')}</ul>
                <p><a href="${frontendUrl}/dashboard">Entrar al sistema</a></p>`,
              );
            }
          }
        }
      }

      // b) Recordatorio al asesor: avance sin revisar (cuello de botella típico).
      const oldest = w.advances[0]?.submittedAt;
      if (advisor && oldest && REVIEW_STATUSES.includes(w.status)) {
        const days = daysBetween(oldest, now);
        if (days >= RISK_RULES.advisorReminderDays) {
          const sent = await this.notifyOnce(advisor.id, 'REVIEW_REMINDER', w.id, null, RISK_RULES.advisorReminderDays, now, {
            title: 'Avance pendiente de revisión',
            message: `"${w.title}" tiene un avance esperando tu revisión desde hace ${days} días.`,
          });
          if (sent) {
            stats.reviewReminders++;
            await this.notifications.sendEmail(
              advisor.email,
              '⏰ Avance pendiente de revisión – UNPHU',
              `<p>Hola ${advisor.firstName},</p><p>El trabajo <strong>"${w.title}"</strong> tiene un avance
              esperando tu revisión desde hace <strong>${days} días</strong>. Tu estudiante no puede continuar hasta recibir tu retroalimentación.</p>
              <p><a href="${frontendUrl}/dashboard/advisor">Revisar ahora</a></p>`,
            );
          }
        }
      }
    }

    // c) Resumen diario: rojo → coordinación; negro → coordinación y dirección.
    const red = works.filter((w) => risks.get(w.id)?.level === 'RED').length;
    const black = works.filter((w) => risks.get(w.id)?.level === 'BLACK').length;
    if (red + black > 0) {
      const roles: UserRole[] = black > 0 ? [UserRole.COORDINATOR, UserRole.DIRECTOR] : [UserRole.COORDINATOR];
      const staff = await this.prisma.user.findMany({
        where: { role: { in: roles }, isActive: true },
        select: { id: true },
      });
      const parts = [red && `${red} en riesgo`, black && `${black} vencida${black === 1 ? '' : 's'}`].filter(Boolean);
      for (const s of staff) {
        const sent = await this.notifyOnce(s.id, 'RISK_DIGEST', null, null, 1, now, {
          title: 'Resumen de seguimiento',
          message: `Hay ${parts.join(' y ')}. Revisa el semáforo en tu panel.`,
          metadata: { red, black },
        });
        if (sent) stats.digests++;
      }
    }

    return stats;
  }

  /**
   * Envía una notificación in-app solo si no se envió una igual (mismo tipo,
   * tesis y nivel) al mismo usuario dentro de la ventana indicada. Evita
   * repetir el mismo aviso cada día.
   */
  private async notifyOnce(
    userId: string,
    type: string,
    thesisWorkId: string | null,
    level: RiskLevel | null,
    windowDays: number,
    now: Date,
    content: { title: string; message: string; metadata?: Record<string, unknown> },
  ): Promise<boolean> {
    const since = new Date(now.getTime() - windowDays * 86_400_000 + 3_600_000); // margen de 1 h
    const and: Prisma.NotificationWhereInput[] = [];
    if (thesisWorkId) and.push({ metadata: { path: ['thesisWorkId'], equals: thesisWorkId } });
    if (level) and.push({ metadata: { path: ['level'], equals: level } });

    const existing = await this.prisma.notification.findFirst({
      where: { userId, type, createdAt: { gte: since }, AND: and },
      select: { id: true },
    });
    if (existing) return false;

    await this.notifications.sendInApp(userId, content.title, content.message, type, {
      ...(content.metadata ?? {}),
      ...(thesisWorkId ? { thesisWorkId } : {}),
      ...(level ? { level } : {}),
    });
    return true;
  }
}
