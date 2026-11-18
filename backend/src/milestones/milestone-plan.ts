import { ThesisStatus } from '@prisma/client';

// ─────────────────────────────────────────────────────────────────────────────
// Plan de hitos por programa: lógica pura (sin BD), compartida por el módulo
// de hitos y por el semáforo de seguimiento.
// ─────────────────────────────────────────────────────────────────────────────

/** Orden del flujo (el del enum ThesisStatus), sin estados terminales/legado. */
const FLOW: ThesisStatus[] = [
  ThesisStatus.POSTULATION,
  ThesisStatus.ACADEMIC_VALIDATION,
  ThesisStatus.PROPOSAL_FORM,
  ThesisStatus.PROPOSAL_REVIEW,
  ThesisStatus.PROPOSAL_APPROVED,
  ThesisStatus.REGISTRO_PROCESSING,
  ThesisStatus.REGISTERED,
  ThesisStatus.COBROS_PROCESSING,
  ThesisStatus.CAJA_PENDING,
  ThesisStatus.PAYMENT_CONFIRMED,
  ThesisStatus.FACULTY_MEETING,
  ThesisStatus.DRAFT_IN_PROGRESS,
  ThesisStatus.DRAFT_UNDER_REVIEW,
  ThesisStatus.DRAFT_APPROVED,
  ThesisStatus.ADVISOR_ASSIGNED,
  ThesisStatus.WORK_STARTED,
  ThesisStatus.IN_DEVELOPMENT,
  ThesisStatus.ADVANCES_SUBMITTED,
  ThesisStatus.ADVISOR_FEEDBACK,
  ThesisStatus.WORK_COMPLETED,
  ThesisStatus.PRESENTATION_SCHEDULED,
  ThesisStatus.PRESENTATION_DONE,
  ThesisStatus.GRADED,
  ThesisStatus.APPROVED,
  ThesisStatus.PUBLISHED,
];

/**
 * Etapas a las que se puede ligar un hito. Solo las que, una vez alcanzadas,
 * no se "desalcanzan": se excluyen las de los ciclos de revisión
 * (propuesta, anteproyecto, avances ↔ retroalimentación).
 */
export const MILESTONE_STATUSES: ThesisStatus[] = [
  ThesisStatus.PROPOSAL_APPROVED,
  ThesisStatus.REGISTERED,
  ThesisStatus.PAYMENT_CONFIRMED,
  ThesisStatus.FACULTY_MEETING,
  ThesisStatus.DRAFT_APPROVED,
  ThesisStatus.ADVISOR_ASSIGNED,
  ThesisStatus.WORK_STARTED,
  ThesisStatus.WORK_COMPLETED,
  ThesisStatus.PRESENTATION_SCHEDULED,
  ThesisStatus.PRESENTATION_DONE,
  ThesisStatus.GRADED,
  ThesisStatus.APPROVED,
  ThesisStatus.PUBLISHED,
];

export const flowIndex = (s: ThesisStatus) => FLOW.indexOf(s);

/** ¿El trabajo (en `current`) ya alcanzó o pasó la etapa `target`? */
export function statusReached(current: ThesisStatus, target: ThesisStatus): boolean {
  const c = flowIndex(current);
  return c >= 0 && c >= flowIndex(target);
}

export interface PlanItem {
  name: string;
  description?: string;
  daysFromStart: number;
  required?: boolean;
  completesAtStatus?: ThesisStatus | null;
}

/** Plan por defecto (licenciatura, ~12 meses) para carreras sin plan propio. */
export const DEFAULT_PLAN: PlanItem[] = [
  { name: 'Propuesta aprobada', daysFromStart: 30, completesAtStatus: ThesisStatus.PROPOSAL_APPROVED,
    description: 'Coordinación aprueba el formulario de propuesta.' },
  { name: 'Inscripción y pago', daysFromStart: 60, completesAtStatus: ThesisStatus.PAYMENT_CONFIRMED,
    description: 'Registro, Cobros y Caja completan la inscripción.' },
  { name: 'Anteproyecto aprobado', daysFromStart: 120, completesAtStatus: ThesisStatus.DRAFT_APPROVED,
    description: 'Dirección aprueba el anteproyecto.' },
  { name: 'Asesor asignado', daysFromStart: 135, completesAtStatus: ThesisStatus.ADVISOR_ASSIGNED },
  { name: 'Marco teórico (capítulos I–II)', daysFromStart: 210, completesAtStatus: null,
    description: 'El asesor lo marca como cumplido al aprobar estos capítulos.' },
  { name: 'Desarrollo y resultados (capítulos III–IV)', daysFromStart: 285, completesAtStatus: null,
    description: 'El asesor lo marca como cumplido al aprobar estos capítulos.' },
  { name: 'Trabajo completo aprobado', daysFromStart: 330, completesAtStatus: ThesisStatus.WORK_COMPLETED,
    description: 'El asesor aprueba el trabajo final para defensa.' },
  { name: 'Defensa realizada', daysFromStart: 365, completesAtStatus: ThesisStatus.PRESENTATION_DONE },
  { name: 'Publicación en repositorio', daysFromStart: 395, completesAtStatus: ThesisStatus.PUBLISHED },
];

export const DUE_SOON_DAYS = 7;

export type MilestoneState = 'DONE' | 'OVERDUE' | 'DUE_SOON' | 'PENDING';

export interface MilestoneLike {
  order: number;
  dueDate: Date;
  required: boolean;
  completesAtStatus: ThesisStatus | null;
  completedAt: Date | null;
}

export interface EvaluatedMilestone<T> {
  milestone: T;
  state: MilestoneState;
  done: boolean;
  /** Cumplido sin marcarse: el trabajo ya pasó un hito posterior ligado a etapa. */
  implicit: boolean;
  daysToDue: number; // negativo si ya venció
}

const DAY_MS = 86_400_000;

/** Evalúa el estado de cada hito para un trabajo en `status`. */
export function evaluateMilestones<T extends MilestoneLike>(
  milestones: T[],
  status: ThesisStatus,
  now = new Date(),
): EvaluatedMilestone<T>[] {
  const sorted = [...milestones].sort((a, b) => a.order - b.order);

  // El hito ligado a etapa más avanzado que ya se alcanzó: todo lo anterior
  // queda implícitamente cumplido.
  let reachedOrder = -Infinity;
  for (const m of sorted) {
    if (m.completesAtStatus && statusReached(status, m.completesAtStatus)) {
      reachedOrder = Math.max(reachedOrder, m.order);
    }
  }

  return sorted.map((m) => {
    const explicit = m.completesAtStatus
      ? statusReached(status, m.completesAtStatus)
      : !!m.completedAt;
    const implicit = !explicit && m.order < reachedOrder;
    const done = explicit || implicit;
    // Días hasta el vencimiento, redondeando hacia cero (0 = vence/venció hoy).
    const daysToDue = Math.trunc((m.dueDate.getTime() - now.getTime()) / DAY_MS);
    const state: MilestoneState = done
      ? 'DONE'
      : m.dueDate.getTime() < now.getTime()
        ? 'OVERDUE'
        : daysToDue <= DUE_SOON_DAYS
          ? 'DUE_SOON'
          : 'PENDING';
    return { milestone: m, state, done, implicit, daysToDue };
  });
}
