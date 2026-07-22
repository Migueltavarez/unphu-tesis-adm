import { ThesisStatus } from '@/types';

// ─────────────────────────────────────────────────────────────────────────────
// "Requieren tu acción": estados en los que es el turno del COORDINADOR de
// actuar ahora. Excluye los estados que esperan a otro rol (estudiante,
// asesor, director, registro, cobros, caja, jurado) o que avanzan solos.
// El orden del objeto define la prioridad de la cola (etapas tempranas primero).
// ─────────────────────────────────────────────────────────────────────────────

export interface CoordinatorAction {
  label: string;      // acción concreta a realizar
  order: number;      // prioridad en la cola
}

const ACTIONS: Partial<Record<ThesisStatus, CoordinatorAction>> = {
  PROPOSAL_REVIEW:        { label: 'Revisar propuesta',            order: 1 },
  PROPOSAL_APPROVED:      { label: 'Enviar a Registro',            order: 2 },
  PAYMENT_CONFIRMED:      { label: 'Convocar reunión de facultad', order: 3 },
  FACULTY_MEETING:        { label: 'Iniciar anteproyecto',         order: 4 },
  DRAFT_APPROVED:         { label: 'Asignar asesor',               order: 5 },
  WORK_COMPLETED:         { label: 'Programar defensa',            order: 6 },
  PRESENTATION_SCHEDULED: { label: 'Marcar defensa realizada',     order: 7 },
  GRADED:                 { label: 'Aprobar trabajo',              order: 8 },
  APPROVED:               { label: 'Publicar en repositorio',      order: 9 },
};

/** Devuelve la acción del coordinador para un estado, o null si no es su turno. */
export function getCoordinatorAction(status: ThesisStatus): CoordinatorAction | null {
  return ACTIONS[status] ?? null;
}

/** Estados en los que el coordinador debe actuar (para filtrar la cola). */
export const COORDINATOR_ACTION_STATUSES = Object.keys(ACTIONS) as ThesisStatus[];
