import { ThesisStatus } from '@prisma/client';

// ─────────────────────────────────────────────────────────────────────────────
// Semáforo de seguimiento por tesis.
//
// Se calcula automáticamente a partir de la actividad real del trabajo; nadie
// lo actualiza a mano. Reglas adaptadas de la especificación (OpenEduCat):
//
//   VERDE    al día: actividad en los últimos 15 días.
//   AMARILLO 15–30 días sin movimiento, o un avance sin revisar > 14 días.
//   ROJO     > 30 días sin movimiento; en desarrollo, > 30 días sin entregar
//            avances; o el tiempo transcurrido supera el cronograma esperado.
//   NEGRO    superó la duración máxima permitida.
//
// "Actividad" = cambio de estado, avance (envío o revisión), documento subido,
// reunión registrada o realizada, o escritura en el editor de tesis.
// Si hay una defensa o reunión ya programada a futuro, la espera es legítima y
// no se marca inactividad.
// ─────────────────────────────────────────────────────────────────────────────

export type RiskLevel = 'GREEN' | 'YELLOW' | 'RED' | 'BLACK';

export interface ThesisRisk {
  level: RiskLevel;
  reasons: string[];          // explicación legible, en orden de gravedad
  lastActivityAt: string;     // ISO
  daysInactive: number;
}

const envInt = (name: string, fallback: number) => {
  const v = parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(v) && v > 0 ? v : fallback;
};

export const RISK_RULES = {
  yellowInactiveDays: envInt('RISK_YELLOW_INACTIVE_DAYS', 15),
  redInactiveDays: envInt('RISK_RED_INACTIVE_DAYS', 30),
  pendingReviewYellowDays: envInt('RISK_PENDING_REVIEW_DAYS', 14),
  noAdvanceRedDays: envInt('RISK_NO_ADVANCE_DAYS', 30),
  expectedMonths: envInt('RISK_EXPECTED_MONTHS', 12),
  maxMonths: envInt('RISK_MAX_MONTHS', 24),
  advisorReminderDays: envInt('RISK_ADVISOR_REMINDER_DAYS', 3),
};

/** Estados cerrados: no llevan semáforo. */
export const CLOSED_STATUSES: ThesisStatus[] = [
  ThesisStatus.PUBLISHED,
  ThesisStatus.REJECTED,
  ThesisStatus.PENDING_PAYMENT, // legado
];

/** Fase de desarrollo con asesor: aquí se exigen avances periódicos. */
export const DEVELOPMENT_STATUSES: ThesisStatus[] = [
  ThesisStatus.WORK_STARTED,
  ThesisStatus.IN_DEVELOPMENT,
  ThesisStatus.ADVISOR_FEEDBACK,
];

/** Estados en los que un avance pendiente de revisión bloquea al estudiante. */
export const REVIEW_STATUSES: ThesisStatus[] = [...DEVELOPMENT_STATUSES, ThesisStatus.ADVANCES_SUBMITTED];

export interface RiskInput {
  status: ThesisStatus;
  startedAt: Date;                    // inicio del proceso (postulación)
  lastActivityAt: Date;
  oldestPendingReviewAt: Date | null; // avance enviado aún sin revisar
  lastAdvanceAt: Date | null;         // último avance entregado
  developmentStartedAt: Date | null;  // entrada a WORK_STARTED
  nextScheduledEventAt: Date | null;  // defensa/reunión futura
  overduePresentationAt?: Date | null; // defensa con fecha pasada sin registrar como realizada
}

const DAY_MS = 86_400_000;
const SEVERITY: Record<RiskLevel, number> = { GREEN: 0, YELLOW: 1, RED: 2, BLACK: 3 };

export const daysBetween = (from: Date, to: Date) =>
  Math.max(0, Math.floor((to.getTime() - from.getTime()) / DAY_MS));

const monthsBetween = (from: Date, to: Date) =>
  (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth()) -
  (to.getDate() < from.getDate() ? 1 : 0);

export function riskSeverity(level: RiskLevel | null | undefined): number {
  return level ? SEVERITY[level] : -1;
}

/** Devuelve el semáforo de una tesis, o null si está cerrada. */
export function computeRisk(input: RiskInput, now = new Date()): ThesisRisk | null {
  if (CLOSED_STATUSES.includes(input.status)) return null;

  const found: { level: RiskLevel; reason: string }[] = [];
  const daysInactive = daysBetween(input.lastActivityAt, now);
  const waitingOnScheduledEvent =
    !!input.nextScheduledEventAt && input.nextScheduledEventAt.getTime() > now.getTime();

  // 1. Duración total del proceso.
  const months = monthsBetween(input.startedAt, now);
  if (months >= RISK_RULES.maxMonths) {
    found.push({ level: 'BLACK', reason: `Superó la duración máxima (${months} de ${RISK_RULES.maxMonths} meses)` });
  } else if (months >= RISK_RULES.expectedMonths) {
    found.push({ level: 'RED', reason: `Supera el tiempo esperado (${months} de ${RISK_RULES.expectedMonths} meses)` });
  }

  // 2. Inactividad general (salvo espera legítima de un evento ya programado).
  if (!waitingOnScheduledEvent) {
    if (daysInactive > RISK_RULES.redInactiveDays) {
      found.push({ level: 'RED', reason: `Sin movimiento hace ${daysInactive} días` });
    } else if (daysInactive >= RISK_RULES.yellowInactiveDays) {
      found.push({ level: 'YELLOW', reason: `Sin movimiento hace ${daysInactive} días` });
    }
  }

  // 3. En desarrollo: se esperan avances periódicos.
  if (DEVELOPMENT_STATUSES.includes(input.status)) {
    const ref = input.lastAdvanceAt ?? input.developmentStartedAt;
    if (ref) {
      const d = daysBetween(ref, now);
      if (d > RISK_RULES.noAdvanceRedDays) {
        found.push({
          level: 'RED',
          reason: input.lastAdvanceAt
            ? `Sin entregar avances hace ${d} días`
            : `Sin ningún avance desde que inició el desarrollo (${d} días)`,
        });
      }
    }
  }

  // 4. Defensa cuya fecha ya pasó y no se registró como realizada.
  if (input.status === ThesisStatus.PRESENTATION_SCHEDULED && input.overduePresentationAt) {
    const d = daysBetween(input.overduePresentationAt, now);
    if (d >= 1) {
      found.push({
        level: d > 7 ? 'RED' : 'YELLOW',
        reason: `La defensa fue hace ${d} días y no se ha registrado como realizada`,
      });
    }
  }

  // 5. Avance esperando revisión del asesor (solo durante el desarrollo).
  if (input.oldestPendingReviewAt && REVIEW_STATUSES.includes(input.status)) {
    const d = daysBetween(input.oldestPendingReviewAt, now);
    if (d > RISK_RULES.pendingReviewYellowDays) {
      found.push({ level: 'YELLOW', reason: `Avance sin revisar por el asesor hace ${d} días` });
    }
  }

  // Más grave primero; a igual gravedad, el motivo específico antes que la
  // inactividad genérica ("Sin movimiento…"), que es menos accionable.
  const generic = (reason: string) => (reason.startsWith('Sin movimiento') ? 1 : 0);
  found.sort((a, b) => SEVERITY[b.level] - SEVERITY[a.level] || generic(a.reason) - generic(b.reason));
  const level: RiskLevel = found[0]?.level ?? 'GREEN';

  return {
    level,
    reasons: found.map((f) => f.reason),
    lastActivityAt: input.lastActivityAt.toISOString(),
    daysInactive,
  };
}
