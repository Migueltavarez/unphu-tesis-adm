import { FeedbackSeverity, FeedbackStatus } from '@prisma/client';

// ─────────────────────────────────────────────────────────────────────────────
// Retroalimentación tipo checklist: transiciones y orden (lógica pura).
//
//   OPEN ──(estudiante: resolver)──▶ RESOLVED ──(asesor: verificar)──▶ VERIFIED
//     ▲                                  │                                │
//     └────────────(asesor: reabrir)─────┴────────────────────────────────┘
//
// El asesor también puede cerrar directamente un punto OPEN que ya no aplica
// (verificar desde OPEN).
// ─────────────────────────────────────────────────────────────────────────────

export type FeedbackAction = 'resolve' | 'verify' | 'reopen';

const TRANSITIONS: Record<FeedbackAction, { from: FeedbackStatus[]; to: FeedbackStatus }> = {
  resolve: { from: [FeedbackStatus.OPEN], to: FeedbackStatus.RESOLVED },
  verify: { from: [FeedbackStatus.OPEN, FeedbackStatus.RESOLVED], to: FeedbackStatus.VERIFIED },
  reopen: { from: [FeedbackStatus.RESOLVED, FeedbackStatus.VERIFIED], to: FeedbackStatus.OPEN },
};

/** Estado destino de la acción, o null si no está permitida desde `current`. */
export function nextFeedbackStatus(current: FeedbackStatus, action: FeedbackAction): FeedbackStatus | null {
  const t = TRANSITIONS[action];
  return t.from.includes(current) ? t.to : null;
}

const STATUS_ORDER: Record<FeedbackStatus, number> = { OPEN: 0, RESOLVED: 1, VERIFIED: 2 };
const SEVERITY_ORDER: Record<FeedbackSeverity, number> = { BLOCKING: 0, MAJOR: 1, MINOR: 2 };

/** Pendientes primero; dentro de cada grupo, lo más grave y lo más antiguo arriba. */
export function compareFeedback(
  a: { status: FeedbackStatus; severity: FeedbackSeverity; createdAt: Date },
  b: { status: FeedbackStatus; severity: FeedbackSeverity; createdAt: Date },
) {
  return (
    STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
    SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
    a.createdAt.getTime() - b.createdAt.getTime()
  );
}

export function summarizeFeedback(items: { status: FeedbackStatus; severity: FeedbackSeverity }[]) {
  return {
    total: items.length,
    open: items.filter((i) => i.status === FeedbackStatus.OPEN).length,
    resolved: items.filter((i) => i.status === FeedbackStatus.RESOLVED).length,
    verified: items.filter((i) => i.status === FeedbackStatus.VERIFIED).length,
    blockingOpen: items.filter((i) => i.status === FeedbackStatus.OPEN && i.severity === FeedbackSeverity.BLOCKING).length,
  };
}
