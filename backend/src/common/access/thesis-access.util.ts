import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '@prisma/client';

/**
 * Roles de staff con acceso transversal a cualquier trabajo de grado.
 * Mantiene la misma política que ThesisWorksService.checkAccess.
 */
const STAFF_ROLES: string[] = [
  UserRole.ADMIN,
  UserRole.COORDINATOR,
  UserRole.DIRECTOR,
  UserRole.REGISTRO,
  UserRole.COBROS,
  UserRole.CAJA,
  UserRole.JURADO,
];

type AccessibleThesis = {
  student?: { userId?: string | null } | null;
  advisor?: { userId?: string | null } | null;
} | null;

/**
 * Verifica que el usuario pueda acceder al trabajo de grado indicado.
 * El staff pasa siempre; el estudiante y el asesor solo si son los dueños.
 * Lanza ForbiddenException en caso contrario.
 *
 * El `thesisWork` debe venir cargado con `student` y `advisor` (al menos su `userId`).
 */
export function assertThesisAccess(
  thesisWork: AccessibleThesis,
  userId: string,
  userRole: UserRole,
): void {
  if (!thesisWork) return; // el caller resuelve el 404 por separado
  if (STAFF_ROLES.includes(userRole)) return;
  if (userRole === UserRole.STUDENT && thesisWork.student?.userId === userId) return;
  if (userRole === UserRole.ADVISOR && thesisWork.advisor?.userId === userId) return;
  throw new ForbiddenException('No tienes acceso a este trabajo');
}
