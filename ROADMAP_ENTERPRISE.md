# Roadmap a nivel Enterprise — UNPHU Tesis

> Plan por fases para llevar la plataforma de "MVP funcional que compila y pasa sus tests"
> a un sistema **enterprise**: seguro, correcto, observable, operable y escalable.
> Cada ítem está anclado a hallazgos reales del QA (ver `QA_REPORT.md`).
> Orden pensado para reducir riesgo primero y agregar valor de negocio después.

---

## Punto de partida (honesto)

Lo que **ya está bien** y no hay que rehacer: arquitectura limpia por capas, guards globales JWT+Roles, validación global, verificaciones IDOR con tests, 171 pruebas E2E verdes, cultura de auditoría. **Sobre esa base se construye.**

Lo que **falta para ser enterprise** no es un rediseño, son cuatro brechas: **(1) seguridad efectiva**, **(2) correctness del flujo de negocio**, **(3) operabilidad** (observabilidad, CI/CD, DR) y **(4) las piezas de negocio que el cliente pidió y no están**.

## Decisión estratégica previa (define medio roadmap)

**¿Una sola institución (UNPHU) o multi-institución/SaaS?**
- **Single-tenant (UNPHU):** el roadmap de abajo tal cual. Más simple.
- **Multi-tenant (SaaS a otras universidades):** agrega desde temprano `organizationId` en el modelo, aislamiento de datos por tenant, y branding/config por institución. Cambiar esto tarde es carísimo. **Si hay cualquier intención de venderlo a otras universidades, decidir AHORA.**

Recomendación: definir esto antes de la Fase 2. El resto del roadmap asume single-tenant con "costuras" para multi-tenant marcadas con 🏢.

---

## Fase 0 — Estabilización de seguridad (1–2 semanas) 🔴 ✅ COMPLETADA (2026-07-22)

*Objetivo: cerrar los agujeros que anulan defensas ya escritas. Nada aquí es grande; todo es de alto impacto.*

| # | Tarea | Hallazgo | Estado |
|---|---|---|---|
| 0.1 | Registrar `ThrottlerGuard` como `APP_GUARD` (proxy-aware; se salta bajo Jest) | S1 | ✅ verificado en vivo: 429 tras 5 logins |
| 0.2 | Exigir auth en el WebSocket + validar pertenencia a la room | S2 | ✅ verificado en vivo: sin/con token inválido → cierre 1008 |
| 0.3 | Control de acceso en `documents` (upload/list) y `thesis-documents` | S3, S4 | ✅ helper `assertThesisAccess` + tests K01/K02/K05 |
| 0.4 | Actualizar `next` a 14.2.35 + axios 1.18.1 (`npm audit`) | C1 | ✅ 0 críticas (de 12→8 vulns; residuales = DoS de Next, requieren major) |
| 0.5 | `helmet()` en el backend + cabeceras de seguridad en nginx | C3 | ✅ headers verificados; nginx `server_tokens off` + X-Frame/CTO/Referrer/Permissions |
| 0.6 | Tokens: access 15 min + refresh rotado/revocable (jti en DB) + logout server-side (back+front) | S5 | ✅ tests L01/L02/L03 + reuse-detection |
| 0.7 | Acceso por dueño/staff en `GET .../payment` (S7) | S7 | ✅ tests K03/K04 |
| + | **Seam multi-tenant `organizationId`** (modelo `Organization`, columna en 5 entidades raíz, migración, seed, register) | — | ✅ tests M01/M02 |

**Resultado:** backend y frontend compilan; **181/181 pruebas E2E verdes** (171 previas + 10 nuevas de Fase 0). Verificación en vivo de throttling, helmet y rechazo del WebSocket.

**Pendiente para fases siguientes** (deuda consciente, no bloqueante): propagar `organizationId` a los `create` de runtime (students/thesis-works) y enforcement de aislamiento por tenant; cookies httpOnly (hoy el token sigue en cookie no-httpOnly + localStorage); residuales `npm audit` de Next.js (DoS) que requieren major.

---

## Fase 1 — Correctness y máquina de estados (2–3 semanas) 🟠 ✅ COMPLETADA (2026-07-22)

*Objetivo: que el flujo no se pueda romper ni dejar en estado inconsistente. Esto es lo que separa "demo" de "sistema de producción".*

| # | Tarea | Hallazgo | Estado |
|---|---|---|---|
| 1.1 | **Máquina de estados centralizada** (`state-machine.ts`, única fuente de verdad) con rol + estado-previo por transición; `updateStatus`, `submit-proposal` y `assign-advisor` pasan por ella | ADVISOR aprobando propuesta; assign desde cualquier estado | ✅ tests N01 (asesor/registro→403, coord→200), N02 (assign inválido→400) |
| 1.2 | **Transacciones atómicas** (`$transaction`) en status, pagos (set-amount/caja-confirm/reject), presentaciones (schedule/complete) y grading | S6 | ✅ estado + historial se persisten juntos |
| 1.3 | `COBROS_PROCESSING` marcado **deprecado** (fuera de la máquina de estados) | Estado muerto | ✅ documentado (no se elimina del enum: recrear un enum Postgres es riesgo desproporcionado) |
| 1.4 | Jurado: **no vacío** (`@ArrayNotEmpty`) + arreglo de "todos calificaron" (requiere jurado>0) | S8 | ✅ test N04 (jurado vacío→400). **Parcial:** el binding jurado→usuario real (hoy `juryMembers` es texto) se difiere a Fase 2 (cambia schema + UI) |
| 1.5 | Cálculo de nota: `finalGrade` derivado de escrito/oral (no `\|\|0`); umbral `GRADE_PASS_THRESHOLD` configurable | Bug de promedio | ✅ test N03 (deriva 85 de 80/90) |
| 1.6 | **Audit log real:** `AuditService` conectado a status/pagos/asignación/grading; **+ fix del bug 500 en `GET /audit`** (skip NaN) | AuditLog muerto | ✅ tests N06/N07; en vivo 38 STATUS_CHANGE + PAYMENT_CONFIRM legibles |
| 1.7 | **Idempotencia** en `caja-confirm` (segundo confirm no re-procesa) | — | ✅ test N05 (cadena completa + doble confirm) |

**Resultado:** backend compila; **188/188 pruebas E2E verdes** (181 + 7 nuevas de Fase 1). Verificado en vivo: rol-por-transición, bitácora de auditoría poblada y legible.

**Deuda consciente (Fase 2+):** binding jurado→usuario real; enforcement de estado-previo en los endpoints de presentación (hoy `schedule` no exige `WORK_COMPLETED` porque el flujo/tests programan desde estados arbitrarios); `ADMIN` sigue pudiendo saltarse la máquina de estados (override de super-admin, por diseño).

---

## Fase 2 — Completar el flujo de negocio pedido (3–4 semanas)

*Objetivo: cubrir lo que el cliente pidió explícitamente y hoy no existe (ver brechas bloqueantes del QA).*

| # | Tarea | Hallazgo | Nota |
|---|---|---|---|
| 2.1 | **Rediseñar `Payment` a 1:N** con `PaymentType` (INSCRIPCION, DERECHO_PRESENTACION, GRADUACION) | Pagos 28 y 34 faltantes | Migración de datos; cambia el `@unique thesisWorkId` |
| 2.2 | **Pago de derecho a presentación** (estado + gate antes de programar + pantalla estudiante + flujo Cobros/Caja) | Paso 28 | Reutiliza la cadena existente Registro→Cobros→Caja |
| 2.3 | **Pago de graduación** (estado tras APPROVED, gate antes de PUBLISHED) | Paso 34 | Idem |
| 2.4 | **Notificación del pago al coordinador** (y a Cobros cuando Registro libera; a Caja cuando Cobros fija monto) | Pasos 10, 14 | Conectar listeners `payment.*` faltantes |
| 2.5 | **Notificación al asesor** al ser asignado + al estudiante del feedback de avance y del resultado de calificación | Pasos 23, 25, 33 | Conectar eventos huérfanos (`advisor-assigned`, `advance.reviewed`, grading) |
| 2.6 | **Reunión Coordinador–Director + "tema definitivo":** conectar `meetings` al flujo, permitir al DIRECTOR, y que la reunión fije `definitiveTopic` y transicione el estado | Pasos 15, 16 | Hoy el módulo está desconectado |
| 2.7 | **Versionado real del anteproyecto:** dar backend al modelo `Draft` (o nodos) + UI de listar/comparar/restaurar versiones (los endpoints ya existen sin uso) | Paso 19 | `listVersions`/`restore` ya en el API, sin pantalla |
| 2.8 | **Publicación automática al aprobar** + marcar el documento final como público | Paso 35 | Hoy es manual y puede quedar sin archivo descargable |
| 2.9 | **Firma:** decidir con negocio si basta texto o se requiere canvas/imagen; en todo caso, `@IsNotEmpty` | Paso 4 | Hoy acepta firma vacía |
| 2.10 | Formulario de Registro que capture los datos que "introduce en su sistema" (si el negocio lo requiere) | Paso 8 | Hoy solo hay botón "Registrar" |

**Salida de fase:** los 35 pasos del flujo del cliente están cubiertos y notificados.

---

## Fase 3 — Testing, calidad y tipado (2–3 semanas, en paralelo)

*Objetivo: que los cambios futuros no rompan lo que funciona. Enterprise = red de seguridad automatizada.*

| # | Tarea | Hallazgo | DoD |
|---|---|---|---|
| 3.1 | **Pruebas unitarias** de la lógica crítica (state machine, cálculo de nota, cadena de pagos) | Solo hay E2E | Cobertura de servicios ≥ 70% |
| 3.2 | **Gate de cobertura en CI** (falla si baja del umbral) | — | PR no mergea sin cobertura mínima |
| 3.3 | **TypeScript strict** en backend y frontend (incremental, módulo por módulo) | Q1 | `strict:true`, eliminar `any` del cliente API |
| 3.4 | **Cliente API tipado** (generar tipos desde el schema OpenAPI/Swagger que ya expone Nest) | 220 `any` en frontend | Tipos end-to-end |
| 3.5 | **Tests de carga** (k6/Artillery) sobre login, listados y WebSocket | — | Línea base de latencia/throughput documentada |
| 3.6 | Tests E2E de UI (Playwright) de los flujos por rol | Solo E2E de API | Camino feliz por rol automatizado |

---

## Fase 4 — Observabilidad y operación (2 semanas)

*Objetivo: cuando algo falle en producción, enterarte antes que el usuario y saber por qué.*

| # | Tarea | DoD |
|---|---|---|
| 4.1 | **Logging estructurado** (JSON, con `requestId`/`correlationId`) — reemplazar los `console.log` de bootstrap por un logger real (pino/winston) | Logs correlacionables por request |
| 4.2 | **Error tracking** (Sentry o similar) en backend y frontend | Excepciones capturadas con stacktrace y contexto |
| 4.3 | **Métricas** (Prometheus) + dashboards (Grafana — ya tienes stack) : latencia, errores, throughput, cola de notificaciones | 🏢 métricas por tenant si SaaS |
| 4.4 | **Health checks profundos** (DB, storage, SMTP) y **readiness/liveness** para orquestador | `/health` distingue "vivo" de "listo" |
| 4.5 | **Exception filter global** que no filtre detalles internos de Prisma al cliente | 500 no expone SQL/stacktrace |
| 4.6 | **Alerting** (error rate, latencia p95, DB caída) hacia tu canal | Alertas accionables, no ruido |

*Nota: tu VPS ya corre Grafana/Prometheus con Authelia — reutilizable aquí.*

---

## Fase 5 — Infraestructura, escalabilidad y DR (2–4 semanas)

*Objetivo: que aguante la carga real (picos en fechas de inscripción/presentación) y sobreviva a un desastre.*

| # | Tarea | Hallazgo | DoD |
|---|---|---|---|
| 5.1 | **TLS/HTTPS** delante de nginx (Let's Encrypt/Traefik) | nginx solo HTTP | HSTS activo, redirect 80→443 |
| 5.2 | **Postgres gestionado** (o al menos réplica + backups automáticos + PITR) | — | Backup diario probado con restore real |
| 5.3 | **Object storage real** (Cloudflare R2 ya soportado) en vez de volumen local | uploads en volumen | Archivos fuera del contenedor, con lifecycle |
| 5.4 | **Redis** para: rate limiting distribuido, cola de notificaciones/emails (BullMQ), caché, y **sesiones/denylist de tokens** | Notif. y emails síncronos; caché en memoria | Emails asíncronos con reintento |
| 5.5 | **Escalado del WebSocket de colaboración** (Yjs con adaptador Redis) para más de una instancia | Server WS en memoria | Colaboración funciona con N réplicas |
| 5.6 | **Contenedores no-root** + imágenes fijadas por digest + escaneo (Trivy) | C2 | `USER node`, imágenes escaneadas en CI |
| 5.7 | **Runbooks + plan DR** (RTO/RPO definidos, restore documentado y ensayado) | — | Simulacro de recuperación exitoso |
| 5.8 | 🏢 IaC (Terraform) si multi-entorno/multi-tenant | — | Infra reproducible |

---

## Fase 6 — Gobernanza, cumplimiento y seguridad avanzada (continuo)

*Objetivo: lo que un cliente institucional/enterprise exige por contrato, no solo por buenas prácticas.*

| # | Tarea | Nota |
|---|---|---|
| 6.1 | **Protección de datos personales** (RD: Ley 172-13): consentimiento, retención, derecho de acceso/eliminación, cifrado en reposo de PII | Los datos de estudiantes son PII |
| 6.2 | **RBAC formal + principio de menor privilegio** revisado rol por rol (hoy ASESOR puede cosas de coordinador) | Hallazgo del QA workflow |
| 6.3 | **Bitácora de auditoría inmutable** (append-only) para acciones financieras y de calificación | Requisito típico de auditoría académica |
| 6.4 | **Gestión de secretos** (Vault/Doppler/SOPS) en vez de `.env` planos en el servidor | — |
| 6.5 | **Pentest externo** anual + programa de dependencias (Dependabot/Renovate) | audit automatizado |
| 6.6 | **Accesibilidad (WCAG AA)** y i18n si aplica | Sector educativo público |
| 6.7 | **Política de backups verificados, retención y borrado** documentada | — |

---

## Transversal — CI/CD y proceso (desde el día 1)

- **Pipeline por PR:** lint + type-check + unit + E2E + `npm audit` + build de imágenes + escaneo. Bloquea merge si algo falla.
- **Entornos:** `dev` → `staging` (espejo de prod) → `prod`, con promoción controlada.
- **Migraciones:** estrategia de migración sin downtime (expand/contract), nunca `migrate dev` en prod.
- **Versionado y releases:** semver, changelog, feature flags para lo grande.
- **Branch protection + code review obligatorio + CODEOWNERS.**
- **ADRs** (Architecture Decision Records) para decisiones grandes (ej: multi-tenant, cambio del modelo Payment).

---

## Secuenciación recomendada

```
Semanas 1-2   │ Fase 0 (seguridad)            ← empezar YA, alto impacto/bajo costo
Semanas 2-5   │ Fase 1 (correctness) + Fase 3 arranca en paralelo (tests)
Semanas 5-9   │ Fase 2 (negocio faltante)     ← decidir single vs multi-tenant ANTES
Semanas 6-8   │ Fase 4 (observabilidad)
Semanas 8-12  │ Fase 5 (infra/DR)
Continuo      │ Fase 6 (gobernanza) + CI/CD transversal desde el día 1
```

## Qué NO es código (pero es parte de "enterprise")
- **Proceso:** on-call, SLAs, gestión de incidentes, postmortems.
- **Documentación viva:** API, runbooks, onboarding, diagramas actualizados.
- **Soporte y versionado del producto:** ciclo de releases, deprecaciones, comunicación a usuarios.

---

## Definición de "listo para enterprise" (checklist de salida)

- [ ] 0 hallazgos críticos/altos de seguridad; pentest externo pasado
- [ ] Máquina de estados imposible de romper por API; todo transaccional
- [ ] Los 35 pasos del flujo cubiertos y notificados
- [ ] Cobertura de tests con gate en CI; TS strict; cliente API tipado
- [ ] Observabilidad completa (logs, métricas, tracing, alertas, error tracking)
- [ ] TLS, backups probados, DR ensayado, storage y colas externas
- [ ] Cumplimiento de datos personales documentado y aplicado
- [ ] CI/CD con entornos dev/staging/prod y migraciones sin downtime
```
