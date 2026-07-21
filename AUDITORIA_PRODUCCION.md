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

---

## Ciclo 2 — BAC-001: asesor sobre trabajos ajenos

**Fecha:** 2026-07-20
**Módulo revisado:** `thesis-works` (backend)
**Método:** reproducción real del acceso indebido → corrección → reprueba (negativo + positivo) → test de regresión → suite E2E.

### Hallazgo (con evidencia)

| ID | Severidad | Descripción | Evidencia (antes) |
|----|-----------|-------------|-------------------|
| **BAC-001** | Medio | `PATCH /thesis-works/:id/status` permitía a **cualquier asesor** cambiar el estado de **cualquier** trabajo, incluso los no asignados a él. El guard de rol es grueso; faltaba la verificación de propiedad por recurso. | Dr. García (asesor) cambió el trabajo de Pedro —`advisorId=null`, no asignado a él— de `GRADED` → `REJECTED` con `200 OK`. |

**Análisis del modelo de autorización:** de los roles habilitados para `updateStatus`
(ADMIN, COORDINATOR, DIRECTOR, REGISTRO, ADVISOR), solo **ADVISOR** está acotado a
recursos (sus tesis asignadas). Coordinación, Dirección y Registro son staff
institucional que legítimamente actúa sobre todos los trabajos, por lo que la
verificación de propiedad se aplica únicamente al rol ADVISOR.

### Corrección aplicada

`thesis-works.service.updateStatus()`: si el actor es `ADVISOR` y
`thesisWork.advisor?.userId !== changedById` → `ForbiddenException`. Los demás roles
staff conservan su alcance institucional. `findOneRaw` ya cargaba `advisor.userId`.

### Reprueba (evidencia después)

| Prueba | Resultado |
|--------|-----------|
| Asesor sobre trabajo **ajeno** | `403 Forbidden` "No tienes acceso a este trabajo de grado" |
| Asesor sobre su **propio** trabajo (control positivo) | `200 OK` (transición aplicada) |

### Pruebas ejecutadas

- Suite E2E completa: **171/171** (se agregó `J03` como regresión de BAC-001).
- Ningún test usaba `advisorToken` en `/status` (verificado antes de tocar), por lo que el endurecimiento no rompe contratos existentes.
- `tsc --noEmit` limpio. Datos mutados en las pruebas (trabajos de Pedro y Ana) **restaurados** a su estado original (`GRADED`).

**Estado del ciclo:** ✅ Cerrado — BAC-001 corregido y verificado. Queda como deuda de bajo riesgo el modelo de jurado por texto libre (ver Ciclo 1).

---

## Ciclo 3 — Base de datos: índices ausentes y estrategia de migraciones

**Fecha:** 2026-07-20
**Módulos revisados:** `prisma/schema.prisma`, migraciones, `Dockerfile`
**Método:** inspección directa de los índices reales en PostgreSQL (`pg_indexes`) vs. el schema, y del estado del historial de migraciones (`migrate status`).

### Hallazgos (con evidencia)

| ID | Severidad | Descripción | Evidencia |
|----|-----------|-------------|-----------|
| **INFRA-005** | Alto | El `Dockerfile` arranca con `prisma migrate deploy`, pero `backend/prisma/migrations/` estaba **gitignoreada** y la única migración (`init`, de jun-8) era **anterior** a casi todos los modelos e índices. En un despliegue limpio (CI / servidor nuevo) `migrate deploy` no encuentra migraciones válidas → **base de datos vacía o incompleta en producción**. | `git check-ignore` confirma el ignore; `migrate status` reporta la init como "not yet applied" pese a que las tablas existen (el esquema se gestionó por `db push`, no por migraciones). |
| **DB-001 / DB-002** | Medio | Los índices y constraints únicos declarados en el schema en auditorías previas **nunca se aplicaron a la BD real** (nunca se corrió `db push`/migración tras editarlos). Todas las consultas por `status`, FKs y tokens hacían *seq scan*. | `pg_indexes` mostraba solo las PK en `thesis_works`, `audit_logs`, etc. — ningún `@@index` del schema. |
| **DB-003** | Medio | Postgres **no** crea índices automáticos en columnas de clave foránea. `advances.thesisWorkId`, `grades.thesisWorkId`, `status_history.thesisWorkId`, `messages.thesisWorkId` y `notifications.userId` —filtradas en cada listado, chat, historial y notificación— no tenían índice. | `pg_indexes` sin índices en esas FKs. |

### Correcciones aplicadas

- **DB-001/DB-002** — `prisma db push` (aditivo, verificado 0 duplicados antes de las constraints únicas): se aplicaron a la BD real los índices de `thesis_works` (status, studentId, advisorId, careerId, status+careerId), `audit_logs` (userId, createdAt) y los `@unique` de `emailVerifyToken`/`resetPasswordToken`.
- **DB-003** — Se agregaron al schema y se aplicaron `@@index([thesisWorkId])` en `advances`, `grades`, `status_history`, `messages`; y `@@index([userId])` + `@@index([userId, isRead])` en `notifications` (conteo de no leídas / SSE).
- **INFRA-005** — Se adoptó el flujo de migraciones correctamente:
  - Se **des-gitignoró** `backend/prisma/migrations/` (las migraciones deben versionarse para `migrate deploy`).
  - Se generó un **baseline** completo desde el schema actual (`migrate diff --from-empty`, 698 líneas, 60 tablas/índices) que reemplaza la migración `init` obsoleta.
  - Se marcó el baseline como aplicado en la BD de desarrollo (`migrate resolve --applied`, sin re-ejecutar → sin pérdida de datos).
  - El `Dockerfile` conserva `migrate deploy`: ahora **sí** produce el esquema completo + índices en un despliegue limpio.

### Reprueba (evidencia después)

| Verificación | Resultado |
|--------------|-----------|
| Índices en `thesis_works` | `status`, `studentId`, `advisorId`, `careerId`, `status+careerId` presentes ✓ |
| Índices FK | `advances`, `grades`, `status_history`, `messages`, `notifications(userId, userId+isRead)` presentes ✓ |
| Constraints únicos | `emailVerifyToken`, `resetPasswordToken` únicos ✓ |
| `prisma migrate status` | "Database schema is up to date!" ✓ |
| Baseline vs schema | sin drift (baseline generado directo del schema) ✓ |
| Suite E2E | **171/171** sin regresiones |

### Pruebas ejecutadas

- `pg_indexes` antes/después; `migrate status`; suite E2E completa.
- `db push` aplicado de forma aditiva (0 duplicados verificados) — sin pérdida de datos; BD de desarrollo intacta (5 trabajos / 13 usuarios).

### Riesgos pendientes / recomendaciones

- **PERF-001** (Medio, documentado en auditoría inicial): `GET /thesis-works/metrics` ejecuta 8 agregaciones sin caché. Con los índices nuevos mejora, pero conviene un caché con TTL. No abordado en este ciclo.
- Recomendación: en adelante, cambios de schema vía `prisma migrate dev` (que genera migración versionada), no `db push`, para mantener el historial coherente con producción.

**Estado del ciclo:** ✅ Cerrado — 3 hallazgos corregidos y verificados; PERF-001 queda como optimización pendiente documentada.

---

## Ciclo 4 — PERF-001: caché de agregaciones de dashboard

**Fecha:** 2026-07-20
**Módulo revisado:** `thesis-works` (backend)
**Método:** medición de latencia real → implementación de caché TTL sin dependencias → verificación funcional del caché (staleness controlada + invalidación) → suite E2E.

### Hallazgo y medición

| ID | Severidad | Descripción | Medición (antes) |
|----|-----------|-------------|------------------|
| **PERF-001** | Medio | `GET /thesis-works/metrics` ejecuta **8 agregaciones** en cada carga del dashboard (admin/coordinación/dirección) y `GET /stats/monthly` otra consulta; sin ningún caché → carga innecesaria sobre la BD cuando varios usuarios de staff refrescan a la vez. | Latencia actual ~9-26 ms (dataset semilla de 5 trabajos). A esta escala la latencia **no** es el problema; el riesgo es de **carga bajo concurrencia y escalabilidad**. |

### Corrección aplicada

Caché en memoria con TTL (**30 s**) en `ThesisWorksService`, sin dependencias nuevas:
- `getMetrics()` y `getMonthlyStats()` se sirven vía `cachedStat(key, producer)`; el cómputo pesado se movió a `computeMetrics()` / `computeMonthlyStats()`.
- **Invalidación inmediata** en las mutaciones del propio servicio que afectan las métricas: `create()`, `updateStatus()`, `assignAdvisor()` → `invalidateStatsCache()`. Las mutaciones de otros servicios (p. ej. calificaciones) se reflejan al expirar el TTL (consistencia eventual, aceptable para un panel de métricas).

### Reprueba (evidencia después)

| Prueba | Resultado |
|--------|-----------|
| **A** — cambio directo en BD (evita la invalidación del servicio) + `GET metrics` dentro del TTL | Devuelve el valor **stale** → confirma que el caché **realmente sirve datos cacheados** (no recomputa en cada llamada). |
| **B** — mutación vía servicio (coordinador `PATCH /status`) + `GET metrics` | Refleja el cambio **+1 de inmediato** → invalidación correcta. |
| Suite E2E (T89 forma, T90/T91 permisos 403, T92 monthly) | **171/171** sin regresiones. |

### Pruebas ejecutadas

- Latencia medida con `curl -w %{time_total}` (5 muestras).
- Probe funcional con Prisma (cambio directo en BD) + `fetch` (mutación vía API) para distinguir caché-hit de invalidación; datos restaurados (Pedro → `GRADED`; base intacta 5/13).
- `tsc --noEmit` limpio.

### Nota de honestidad técnica

A la escala de datos actual la latencia ya era baja; esta optimización es de **endurecimiento ante carga/escala**, no una corrección de latencia observable hoy. El TTL de 30 s introduce consistencia eventual en métricas provenientes de servicios externos (calificaciones), lo cual es un compromiso estándar y aceptable para paneles.

**Estado del ciclo:** ✅ Cerrado — PERF-001 mitigado con caché TTL + invalidación, verificado funcionalmente.
