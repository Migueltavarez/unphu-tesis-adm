import { ThesisStatus } from '@/types';

// ─────────────────────────────────────────────────────────────────────────────
// "Requieren tu acción" del ASESOR: estados de sus trabajos asignados en los
// que es su turno de actuar ahora. Excluye los estados que esperan al
// estudiante (desarrollando / aplicando correcciones) o a otro rol.
// ─────────────────────────────────────────────────────────────────────────────

export interface AdvisorAction {
  label: string;   // acción concreta
  order: number;   // prioridad en la cola
}

const ACTIONS: Partial<Record<ThesisStatus, AdvisorAction>> = {
  ADVANCES_SUBMITTED: { label: 'Revisar avance',    order: 1 }, // el estudiante espera respuesta
  ADVISOR_ASSIGNED:   { label: 'Iniciar desarrollo', order: 2 }, // trabajo recién asignado
};

/** Devuelve la acción del asesor para un estado, o null si no es su turno. */
export function getAdvisorAction(status: ThesisStatus): AdvisorAction | null {
  return ACTIONS[status] ?? null;
}
