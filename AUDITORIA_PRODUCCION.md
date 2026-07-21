# Auditoría de Producción — UNPHU Tesis

Registro continuo de la auditoría técnica (ciclo Analizar → Probar → Corregir → Reprobar → Documentar).
No se elimina información anterior; cada ciclo se anexa.

Auditorías previas y su evidencia viven en el historial de git y en el artifact de la
auditoría inicial. Este documento cubre los ciclos posteriores.

---

## Ciclo 1 — Autorización a nivel de recurso (IDOR / Broken Access Control)

**Fecha:** 2026-07-20
**Módulos revisados:** `advances`, `presentations` (backend)
**Método:** lectura de código + pruebas de ataque reales contra la API en ejecución
(evidencia antes de concluir), corrección, reejecución de las mismas pruebas y de la
suite E2E completa.

### Hallazgos (con evidencia)

| ID | Severidad | Descripción | Evidencia (antes) |
|----|-----------|-------------|-------------------|
| **IDOR-001** | Alto | `POST /thesis-works/:id/advances` (rol STUDENT) no verificaba propiedad: cualquier estudiante podía enviar avances a la tesis de otro. | Estudiante recién registrado creó un avance en la tesis de Ana → `201 Created`. |
| **GRADE-001** | Alto | `POST /thesis-works/:id/presentation/grades` tomaba `evaluatorId` y `evaluatorName` del body → suplantación de evaluador y posibilidad de inflar el promedio con múltiples notas falsas bajo identidades inventadas (la aprobación es automática al promediar). | Un jurado registró una nota con `evaluatorId:"id-falso-999"`, nombre `"Evaluador Falsificado"` y `finalGrade:100` → `201 Created`, aceptada tal cual. |
| **IDOR-002** | Medio | `POST /thesis-works/x/advances/:id/comments` no tenía guard de rol ni de participación: cualquier usuario autenticado podía comentar avances ajenos. | Estudiante ajeno comentó el avance de otra tesis → `201 Created`. |
| **BAC-001** | Medio (documentado, no corregido) | `PATCH /thesis-works/:id/status` valida rol grueso (rechaza STUDENT → 403 ✓) pero no verifica que el actor staff (asesor/director/registro) esté relacionado con ese trabajo específico. | STUDENT → `403` (correcto). Cross-staff no reproducible con un solo asesor semilla. |

### Correcciones aplicadas

- **IDOR-001** — `advances.service.create()` ahora carga el trabajo con `student.userId` y lanza `ForbiddenException` si el `userId` autenticado no es el dueño.
- **GRADE-001** — `presentations.service.recordGrade()` deriva `evaluatorId` y `evaluatorName` del **usuario autenticado** (ignora el body) y aplica **una nota por evaluador** (`ConflictException` en duplicado). El DTO marca esos campos como opcionales/ignorados.
- **IDOR-002** — `advances.service.addComment()` exige ser el estudiante dueño, el asesor asignado o staff (coordinación/dirección/admin); si no, `ForbiddenException`. Se extrajo `insertComment()` privado para la ruta interna del revisor (que ya pasó el guard de rol).

### Reprueba (evidencia después)

| Prueba | Resultado |
|--------|-----------|
| IDOR-001: avance a tesis ajena | `403 Forbidden` "No puedes enviar avances a un trabajo que no es tuyo" |
| GRADE-001: nota con identidad falsa | `201` pero **guarda la identidad real** (`Roberto Martínez`), ignora la falsa |
| GRADE-001: segunda nota del mismo jurado | `409 Conflict` "Ya registraste una calificación para este trabajo" |
| IDOR-002: comentario ajeno | `403 Forbidden`; control positivo (dueña comenta lo suyo) → `201` |

### Pruebas ejecutadas

- Suite E2E completa: **170/170** (168 previos + `J01` IDOR avance, `J02` identidad de evaluador).
- `tsc --noEmit` backend: sin errores.
- Datos de prueba creados durante los ataques: **eliminados**; base restaurada a 5 trabajos / 13 usuarios.

### Riesgos pendientes

- **BAC-001** (Medio): agregar verificación de propiedad por trabajo en `updateStatus` para roles staff (asesor solo sobre trabajos asignados; registro/cobros/caja/director según su etapa). Requiere mapear rol→etapa; riesgo medio, se recomienda su propia iteración con tests.
- **Modelo de jurado por texto libre** (Bajo/Deuda): `Presentation.juryMembers` son strings (ej. `"Dr. Roberto Martínez"`), no referencias a `User`. Impide una verificación estricta de pertenencia del jurado al tribunal. Recomendación futura: modelar el jurado como relación a usuarios.

**Estado del ciclo:** ✅ Cerrado — 3 hallazgos corregidos y verificados, 2 documentados como pendientes.
