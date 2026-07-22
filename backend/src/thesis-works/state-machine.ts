import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ThesisStatus, UserRole } from '@prisma/client';

/**
 * Máquina de estados del trabajo de grado — ÚNICA fuente de verdad.
 *
 * Cada arista declara `from → to` y los roles que pueden ejecutarla. Todas las
 * mutaciones de `status` (endpoint genérico y endpoints dedicados) pasan por
 * `assertTransition`, de modo que no exista una "puerta trasera" que permita
 * saltar etapas o que un rol ejecute una transición que no le corresponde.
 *
 * COORDINATOR y ADMIN son "dueños del proceso": conducen la ruta manual del
 * expediente, por eso aparecen en casi todas las aristas de staff. ADMIN además
 * puede saltarse la validación para correcciones excepcionales (ver assertTransition).
 */
const S = ThesisStatus;
const R = UserRole;

export interface Transition {
  from: ThesisStatus;
  to: ThesisStatus;
  roles: UserRole[];
}

export const TRANSITIONS: Transition[] = [
  // ── Postulación y validación académica ──────────────────────
  { from: S.POSTULATION, to: S.ACADEMIC_VALIDATION, roles: [R.COORDINATOR, R.ADMIN] },
  { from: S.ACADEMIC_VALIDATION, to: S.PROPOSAL_FORM, roles: [R.COORDINATOR, R.ADMIN] },

  // ── Propuesta (submit-proposal es del estudiante) ───────────
  { from: S.PROPOSAL_FORM, to: S.PROPOSAL_REVIEW, roles: [R.STUDENT] },
  { from: S.POSTULATION, to: S.PROPOSAL_REVIEW, roles: [R.STUDENT] }, // flujo abreviado
  { from: S.PROPOSAL_REVIEW, to: S.PROPOSAL_APPROVED, roles: [R.COORDINATOR, R.ADMIN] }, // el asesor ya NO
  { from: S.PROPOSAL_REVIEW, to: S.PROPOSAL_FORM, roles: [R.COORDINATOR, R.ADMIN] },

  // ── Registro ────────────────────────────────────────────────
  { from: S.PROPOSAL_APPROVED, to: S.REGISTRO_PROCESSING, roles: [R.COORDINATOR, R.ADMIN, R.REGISTRO] },
  { from: S.REGISTRO_PROCESSING, to: S.REGISTERED, roles: [R.COORDINATOR, R.ADMIN, R.REGISTRO] },

  // ── Pagos (endpoints dedicados set-amount / caja-confirm) ───
  { from: S.REGISTERED, to: S.CAJA_PENDING, roles: [R.COBROS, R.ADMIN] },
  { from: S.CAJA_PENDING, to: S.PAYMENT_CONFIRMED, roles: [R.CAJA, R.ADMIN] },

  // ── Reunión con Dirección y anteproyecto ────────────────────
  { from: S.PAYMENT_CONFIRMED, to: S.FACULTY_MEETING, roles: [R.COORDINATOR, R.ADMIN] },
  { from: S.FACULTY_MEETING, to: S.DRAFT_IN_PROGRESS, roles: [R.COORDINATOR, R.ADMIN] },
  { from: S.DRAFT_IN_PROGRESS, to: S.DRAFT_UNDER_REVIEW, roles: [R.COORDINATOR, R.ADMIN, R.STUDENT] },
  { from: S.DRAFT_UNDER_REVIEW, to: S.DRAFT_APPROVED, roles: [R.COORDINATOR, R.ADMIN, R.DIRECTOR] },
  { from: S.DRAFT_UNDER_REVIEW, to: S.DRAFT_IN_PROGRESS, roles: [R.COORDINATOR, R.ADMIN, R.DIRECTOR] },

  // ── Asignación de asesor (endpoint dedicado) ────────────────
  { from: S.DRAFT_APPROVED, to: S.ADVISOR_ASSIGNED, roles: [R.COORDINATOR, R.ADMIN] },
  { from: S.FACULTY_MEETING, to: S.ADVISOR_ASSIGNED, roles: [R.COORDINATOR, R.ADMIN] }, // flujo abreviado

  // ── Desarrollo del trabajo ──────────────────────────────────
  { from: S.ADVISOR_ASSIGNED, to: S.WORK_STARTED, roles: [R.COORDINATOR, R.ADMIN, R.ADVISOR] },
  { from: S.WORK_STARTED, to: S.IN_DEVELOPMENT, roles: [R.COORDINATOR, R.ADMIN, R.ADVISOR] },
  { from: S.IN_DEVELOPMENT, to: S.ADVANCES_SUBMITTED, roles: [R.STUDENT] }, // vía advances
  { from: S.ADVANCES_SUBMITTED, to: S.ADVISOR_FEEDBACK, roles: [R.COORDINATOR, R.ADMIN, R.ADVISOR] },
  { from: S.ADVANCES_SUBMITTED, to: S.IN_DEVELOPMENT, roles: [R.COORDINATOR, R.ADMIN, R.ADVISOR] },
  { from: S.ADVISOR_FEEDBACK, to: S.IN_DEVELOPMENT, roles: [R.COORDINATOR, R.ADMIN, R.ADVISOR] },
  { from: S.IN_DEVELOPMENT, to: S.WORK_COMPLETED, roles: [R.COORDINATOR, R.ADMIN, R.ADVISOR] },
  { from: S.ADVISOR_FEEDBACK, to: S.WORK_COMPLETED, roles: [R.COORDINATOR, R.ADMIN, R.ADVISOR] },

  // ── Presentación y calificación ─────────────────────────────
  { from: S.WORK_COMPLETED, to: S.PRESENTATION_SCHEDULED, roles: [R.COORDINATOR, R.ADMIN] },
  { from: S.PRESENTATION_SCHEDULED, to: S.PRESENTATION_DONE, roles: [R.COORDINATOR, R.ADMIN] },
  { from: S.PRESENTATION_DONE, to: S.GRADED, roles: [R.COORDINATOR, R.ADMIN, R.JURADO, R.EVALUATOR] },
  { from: S.GRADED, to: S.APPROVED, roles: [R.COORDINATOR, R.ADMIN, R.JURADO, R.EVALUATOR] },

  // ── Publicación ─────────────────────────────────────────────
  { from: S.APPROVED, to: S.PUBLISHED, roles: [R.COORDINATOR, R.ADMIN] },
];

// REJECTED es alcanzable desde muchas etapas por coordinación / dirección / admin.
const REJECTABLE_FROM: ThesisStatus[] = [
  S.POSTULATION, S.ACADEMIC_VALIDATION, S.PROPOSAL_REVIEW, S.PROPOSAL_APPROVED,
  S.PAYMENT_CONFIRMED, S.FACULTY_MEETING, S.DRAFT_IN_PROGRESS, S.DRAFT_UNDER_REVIEW,
  S.ADVISOR_ASSIGNED, S.WORK_COMPLETED, S.GRADED,
];
for (const from of REJECTABLE_FROM) {
  TRANSITIONS.push({ from, to: S.REJECTED, roles: [R.COORDINATOR, R.ADMIN, R.DIRECTOR] });
}

// Índice `from->to` → conjunto de roles (une roles de aristas duplicadas).
const EDGE_ROLES = new Map<string, Set<UserRole>>();
for (const t of TRANSITIONS) {
  const key = `${t.from}->${t.to}`;
  const set = EDGE_ROLES.get(key) ?? new Set<UserRole>();
  t.roles.forEach((r) => set.add(r));
  EDGE_ROLES.set(key, set);
}

/** ¿Existe la arista from→to (sin considerar rol)? */
export function isValidTransition(from: ThesisStatus, to: ThesisStatus): boolean {
  return EDGE_ROLES.has(`${from}->${to}`);
}

/**
 * Valida una transición de estado. Lanza:
 * - BadRequestException (400) si la arista no existe (transición inválida).
 * - ForbiddenException (403) si la arista existe pero el rol no puede ejecutarla.
 * ADMIN puede saltarse la validación para correcciones excepcionales.
 */
export function assertTransition(from: ThesisStatus, to: ThesisStatus, role: UserRole): void {
  if (role === UserRole.ADMIN) return;
  const roles = EDGE_ROLES.get(`${from}->${to}`);
  if (!roles) {
    throw new BadRequestException(
      `Transición no permitida: no se puede pasar de "${from}" a "${to}".`,
    );
  }
  if (!roles.has(role)) {
    throw new ForbiddenException(
      `El rol ${role} no puede ejecutar la transición "${from}" → "${to}".`,
    );
  }
}
