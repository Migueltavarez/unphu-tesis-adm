import { ExtensionStatus, ThesisStatus } from '@prisma/client';
import { flowIndex } from '../milestones/milestone-plan';

// ─────────────────────────────────────────────────────────────────────────────
// Prórrogas (OpenEduCat): solicitud justificada → aval del asesor →
// aprobación de Coordinación, con plazos y escalamiento en cada paso.
//
//   PENDING_ADVISOR ──aval──▶ PENDING_COORDINATOR ──aprueba──▶ APPROVED
//        │  └─(sin respuesta N días: Coordinación puede decidir)─┘   │
//        └──rechaza──▶ REJECTED ◀──rechaza──┘           el estudiante cancela
//                                                        → CANCELLED
// ─────────────────────────────────────────────────────────────────────────────

const envInt = (name: string, fallback: number) => {
  const v = parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(v) && v > 0 ? v : fallback;
};

export const EXTENSION_RULES = {
  minDays: 1,
  maxDays: 180,
  minReason: 30,
  /** Días sin respuesta tras los que el paso se escala. */
  escalationDays: envInt('EXTENSION_ESCALATION_DAYS', 5),
};

export const OPEN_EXTENSION: ExtensionStatus[] = [
  ExtensionStatus.PENDING_ADVISOR,
  ExtensionStatus.PENDING_COORDINATOR,
];

const DAY_MS = 86_400_000;
export const daysWaiting = (since: Date, now = new Date()) =>
  Math.max(0, Math.floor((now.getTime() - since.getTime()) / DAY_MS));

/** Se puede pedir prórroga mientras el trabajo está activo y antes de la defensa. */
export function canRequestExtension(status: ThesisStatus): boolean {
  const i = flowIndex(status);
  return i >= 0 && i < flowIndex(ThesisStatus.PRESENTATION_DONE);
}

/**
 * Coordinación decide cuando el asesor ya avaló, o cuando el asesor lleva
 * `escalationDays` sin responder (escalamiento).
 */
export function coordinatorCanDecide(
  ext: { status: ExtensionStatus; createdAt: Date },
  now = new Date(),
): boolean {
  if (ext.status === ExtensionStatus.PENDING_COORDINATOR) return true;
  return ext.status === ExtensionStatus.PENDING_ADVISOR && daysWaiting(ext.createdAt, now) >= EXTENSION_RULES.escalationDays;
}

/** ¿El paso actual está escalado (lleva demasiado sin respuesta)? */
export function isEscalated(
  ext: { status: ExtensionStatus; createdAt: Date; advisorDecidedAt: Date | null },
  now = new Date(),
): boolean {
  if (ext.status === ExtensionStatus.PENDING_ADVISOR) {
    return daysWaiting(ext.createdAt, now) >= EXTENSION_RULES.escalationDays;
  }
  if (ext.status === ExtensionStatus.PENDING_COORDINATOR) {
    return daysWaiting(ext.advisorDecidedAt ?? ext.createdAt, now) >= EXTENSION_RULES.escalationDays;
  }
  return false;
}
