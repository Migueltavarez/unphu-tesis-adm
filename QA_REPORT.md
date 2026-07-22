# Informe de QA — UNPHU Tesis

> QA ejecutado el 2026-07-22 sobre el repo clonado y corriendo en local.
> Dos frentes: **(A) cobertura funcional** del flujo de negocio descrito por el cliente,
> y **(B) QA técnico** (funcionamiento, errores, buenas prácticas, pruebas automáticas).
> Metodología: la app se levantó completa (backend :3001, frontend :3000, Postgres Docker),
> se corrió la suite de pruebas, se compilaron ambos proyectos y se revisó el código estáticamente.

---

## Veredicto en una línea

El sistema cubre **la columna vertebral del flujo** (postulación → propuesta → pago de inscripción → asesor → avances → presentación → calificación → repositorio) y **compila, corre y pasa sus 171 pruebas E2E**. Pero le faltan **piezas concretas de negocio** que el cliente pidió explícitamente (los **dos pagos extra**, la **notificación del pago al coordinador**, la **reunión con el Director y el "tema definitivo"**, el **versionado real del anteproyecto**) y tiene **agujeros de seguridad de alto impacto** (throttling apagado, WebSocket sin auth, dos módulos sin control de acceso). **No está listo para producción tal cual**, pero ninguna corrección requiere rediseño.

---

# A. Cobertura funcional del flujo (paso por paso)

Leyenda: ✅ cubierto · ⚠️ parcial / con salvedad · ❌ faltante

| # | Paso del flujo pedido | Estado | Detalle |
|---|---|---|---|
| 1 | Registro / login (cualquier involucrado) | ✅ | Login, registro, forgot/reset password, verify-email. **Salvedad:** el auto-registro crea *siempre* estudiante; los roles administrativos los crea el admin. |
| 2 | Estudiante se postula | ✅ | `POST /thesis-works`, UI `student/thesis/new`. Valida elegibilidad + que no tenga otra tesis activa. |
| 3 | Coordinador valida académicamente | ⚠️ | Existe (`validateEligibility`), pero es un **flag por estudiante desacoplado del pipeline**; el estado `ACADEMIC_VALIDATION` está marcado como legado. Además un ASESOR también puede disparar transiciones que son del coordinador. |
| 4 | Formulario de propuesta: Nombre, Matrícula, Carrera, Tema, Correo, **Firma** | ⚠️ | **Los 6 campos aparecen en la UI**, pero 5 son autocompletados de solo lectura (perfil/postulación) y solo la **firma** se envía. La firma es un **campo de texto tipeado** (fuente cursiva), **no manuscrita ni imagen**. El DTO solo valida `firma` y **acepta firma vacía** (`@IsString()` sin `@IsNotEmpty`). |
| 5 | Coordinador revisa el formulario | ✅ | `coordinator/works/[id]` muestra los datos + firma. |
| 6 | Coordinador aprueba el formulario | ✅ | Transición `PROPOSAL_REVIEW → PROPOSAL_APPROVED`. **Salvedad:** el guard también deja aprobar al ASESOR. |
| 7 | Formulario se envía a Registro | ✅ | `PROPOSAL_APPROVED → REGISTRO_PROCESSING`. |
| 8 | Registro introduce datos y marca "registrado" | ⚠️ | Solo hay un botón **"Registrar"**; **no existe formulario que capture datos** en el sistema de Registro. Solo cambia el estado. |
| 9 | Registro libera → a Cobros | ✅ | `REGISTRO_PROCESSING → REGISTERED`. |
| 10 | Cobros recibe confirmación de liberación | ⚠️ | No hay **notificación** a Cobros; el evento `payment.amount-set` se emite pero **no tiene listener**. Cobros ve los trabajos liberados por listado, no por aviso. |
| 11 | Cobros digita el monto → a Caja | ✅ | `PATCH .../payment/set-amount` (rol COBROS). **Salvedad:** salta el estado `COBROS_PROCESSING`, que queda **muerto** (nunca se asigna); va directo `REGISTERED → CAJA_PENDING`. |
| 12 | Caja recibe monto + datos (Nombre, Matrícula, Monto) | ✅ | `GET /payments` (rol CAJA) incluye nombre, matrícula, carrera y monto. |
| 13 | Caja cobra y registra como pagado | ✅ | `PATCH .../payment/caja-confirm` → `PAYMENT_CONFIRMED`. |
| 14 | **Coordinador recibe notificación del pago** | ❌ | **Requisito explícito no cumplido.** El listener de `payment.confirmed` **solo notifica al estudiante**; el coordinador **nunca** es notificado. No hay ninguna referencia a `COORDINATOR` en el servicio de notificaciones. |
| 15 | Coordinador coordina reunión con el Director | ❌/⚠️ | La transición `PAYMENT_CONFIRMED → FACULTY_MEETING` existe, pero el **módulo de reuniones no está conectado**: `meetings.complete` solo marca `completed=true`, **no transiciona ni fija el tema**, la UI de reuniones solo existe en el panel del **asesor**, y **el DIRECTOR ni siquiera puede crear reuniones** (el guard no lo incluye). |
| 16 | De la reunión sale el "tema definitivo" | ❌/⚠️ | El campo `definitiveTopic` existe en el modelo, pero **no hay UI ni lógica que lo fije** a partir de la reunión. |
| 17 | Coordinador libera elaboración del anteproyecto | ⚠️ | Se cubre con el cambio de estado `FACULTY_MEETING → DRAFT_IN_PROGRESS`; no hay notificación específica del "tema". |
| 18 | Estudiante desarrolla el anteproyecto | ⚠️ | Hay editor de documento por nodos, pero el modelo `Draft` (anteproyecto) **no tiene backend**: los estados `DRAFT_*` se mueven solo por cambio de estado manual. |
| 19 | **Anteproyecto versionado por correcciones del director** | ❌/⚠️ | El ciclo de correcciones por *estado* existe, pero **no hay versionado real de contenido**: `Draft.version` nunca se usa y los endpoints `listVersions`/`restore` existen pero **ninguna pantalla los usa**. |
| 20 | Director aprueba el anteproyecto | ⚠️ | `DRAFT_UNDER_REVIEW → DRAFT_APPROVED` existe, pero **no exige el rol DIRECTOR** (lo puede hacer asesor/registro), y el director aprueba **sin ver el contenido del anteproyecto inline**. |
| 21 | Coordinación recibe notificación para asignar asesor | ⚠️ | La transición notifica de forma genérica (`status-changed`); no es una notificación dedicada. |
| 22 | Coordinador asigna asesor | ✅ | `PATCH .../assign-advisor` (COORDINATOR/ADMIN), con carga por asesor. **Salvedad:** no valida el estado previo (puede asignar desde cualquier estado). |
| 23 | **Asesor recibe notificación del proyecto** | ❌ | El evento `thesis.advisor-assigned` se emite pero **no tiene listener** → el asesor **no es notificado**. |
| 24 | Se inicia el trabajo de tesis | ✅ | `ADVISOR_ASSIGNED → WORK_STARTED → IN_DEVELOPMENT`. |
| 25 | Asesor valida el progreso | ✅ | Avances con revisión (Aprobar / Pedir revisión). **Salvedad:** `advance.reviewed` no tiene listener → el estudiante **no es notificado** del feedback. |
| 26 | Asesor aprueba todos los módulos → listo para presentar | ⚠️ | `WORK_COMPLETED` existe, pero **no verifica que los módulos/nodos estén realmente aprobados**; es un cambio de estado manual. |
| 27 | Trabajo listo para presentación | ✅ | Estado `WORK_COMPLETED`. |
| 28 | **Estudiante paga derecho a presentación** | ❌ | **No existe.** No hay estado, pantalla ni tipo de pago. El modelo `Payment` es **1:1 con el trabajo** (`thesisWorkId @unique`) → imposible un segundo pago sin cambio de modelo. |
| 29 | Coordinador gestiona la fecha de presentación | ✅ | `POST .../presentation/schedule`. **Salvedad:** no valida `WORK_COMPLETED` ni escribe en el historial de estados. |
| 30 | Coordinador asigna el jurado | ✅ | `juryMembers` en el schedule. **Salvedad:** es **texto libre**, no vinculado a usuarios con rol JURADO. |
| 31 | Se presenta el trabajo | ⚠️ | `PATCH .../presentation/complete`, sin validación de estado ni notificación. |
| 32 | El jurado califica | ✅ | `recordGrade` toma la identidad del token (anti-spoof), 1 nota por evaluador. **Salvedad:** cualquier usuario JURADO puede calificar cualquier tesis; bug de promedio (ver B/F). |
| 33 | Estudiante aprueba o reprueba según la nota | ✅ | Umbral **≥70** (hardcodeado en 2 sitios). **Salvedad:** el estudiante **no recibe notificación** del resultado. |
| 34 | **Si aprueba, paga la graduación** | ❌ | **No existe.** `APPROVED → PUBLISHED` es directo, sin estado ni pantalla de pago. |
| 35 | Si aprueba, se publica en el repositorio | ⚠️ | El repositorio público (solo `PUBLISHED`) funciona, pero la publicación es **manual, no automática** al aprobar, y publicar **no marca el documento como público** → el trabajo puede quedar visible **sin archivo final descargable**. |

### Resumen de brechas funcionales (vs. lo pedido)

**Bloqueantes (requisito explícito no cubierto):**
1. ❌ **Pago de derecho a presentación** (paso 28) — no modelado.
2. ❌ **Pago de graduación** (paso 34) — no modelado. *(1 y 2 requieren cambiar `Payment` de 1:1 a 1:N con un tipo de pago.)*
3. ❌ **Notificación del pago al coordinador** (paso 14) — solo se notifica al estudiante.
4. ❌ **Notificación al asesor al ser asignado** (paso 23) — evento sin listener.
5. ❌/⚠️ **Reunión con el Director + "tema definitivo"** (pasos 15-16) — módulo desconectado; el Director no puede crear reuniones.
6. ❌/⚠️ **Versionado real del anteproyecto** (paso 19) — modelado pero sin backend/UI.

**Salvedades importantes:**
- La **firma** es texto tipeado, no manuscrita/imagen (revisar si el negocio exige firma gráfica), y **se acepta vacía**.
- El estado `COBROS_PROCESSING` está **muerto**; el paso de Cobros no deja rastro propio en el historial.
- Varias transiciones **no validan el estado previo** (submit-proposal acepta POSTULATION, assign-advisor y las de presentación no validan) → **se pueden saltar etapas** vía API.
- La **validación académica** es un flag desacoplado, no un gate real del pipeline.

---

# B. QA técnico

## ¿Funciona? ¿Compila? ¿Tiene errores?

| Verificación | Resultado |
|---|---|
| Backend arranca (`start:dev`) | ✅ health 200, login 200 (JWT) |
| Frontend arranca (`dev`) + build | ✅ build de producción sin errores |
| Backend `nest build` | ✅ sin errores |
| Frontend `tsc --noEmit` (type-check) | ✅ sin errores |
| Migraciones Prisma + seed | ✅ 7 roles + 4 estudiantes + 4 trabajos |

## Pruebas automáticas

**Sí tiene pruebas.** ✅ **171 pruebas E2E, todas pasan** (4.7 s), en 2 archivos (`test/system.e2e-spec.ts`, `test/extended.e2e-spec.ts`).

- **Cobertura buena del camino feliz y de seguridad:** flujo completo de tesis, cadena de pagos, presentaciones, repositorio público, **ruta de rechazo**, **regresión IDOR** (J01-J03), y **casos límite de seguridad** (inyección SQL, XSS, JWT manipulado, `forbidNonWhitelisted`).
- **Debilidad:** son **solo E2E** — **no hay pruebas unitarias** (`.spec.ts`) de servicios. La lógica fina (umbral de calificación, promedio del jurado, atomicidad) no tiene tests aislados. No se detectó reporte de cobertura.

## Buenas prácticas — hallazgos por severidad

### 🔴 Crítico
- **S1 — Rate limiting configurado pero NO aplicado.** `ThrottlerModule` y `@Throttle` están, pero **nunca se registra `ThrottlerGuard`** como `APP_GUARD` → el login y todo lo demás quedan **sin throttling** (fuerza bruta de credenciales y de tokens de reset sin límite). Fix de una línea en `app.module`.
- **S2 — WebSocket de colaboración sin autenticación obligatoria.** En `collaboration.server.ts` el token es opcional y si falla la verificación **se continúa igual**. Cualquiera que adivine un `roomName` puede **leer/editar** el documento de cualquier tesis, saltándose todo el control REST.
- **C1 — Frontend con vulnerabilidad crítica de dependencia.** `next@14.1.0` arrastra 1 crítica + varias altas (bypass de middleware, SSRF, XSS). Actualizar a `14.2.x` LTS.

### 🟠 Alto
- **S3 — Módulo `documents` sin autorización** en subir y listar: cualquier autenticado puede adjuntar documentos a la tesis de otro y listar sus metadatos. *(descargar y borrar sí validan dueño.)*
- **S4 — Módulo `thesis-documents` sin control de acceso por recurso:** cualquiera puede leer/crear el árbol de nodos del documento de cualquier tesis por ID.
- **S5 — Refresh tokens sin rotación ni revocación, sin logout de servidor.** Un refresh robado vale **30 días** sin poder invalidarse; el access token dura **7 días** (ventana muy larga).

### 🟡 Medio
- **S6 — Cadena de pagos y cambios de estado NO transaccionales.** `setAmount`/`confirmByCaja`/presentaciones usan `Promise.all` (no atómico) → riesgo de estado inconsistente si una escritura falla. *(Irónicamente, `advances` sí usa `$transaction`.)*
- **S7 — `GET /thesis-works/:id/payment` sin restricción de rol** → un estudiante ajeno puede ver el pago de cualquier tesis.
- **S8 — Jurado por texto libre:** cualquier usuario JURADO puede calificar cualquier tesis; y si `juryMembers` está vacío, una sola nota dispara aprobado/reprobado.
- **Bug de promedio del jurado:** el promedio usa `finalGrade || 0`; si un jurado registra solo nota escrita/oral sin `finalGrade`, cuenta como **0** y puede **reprobar injustamente**.
- **Q1 — TypeScript no estricto** en backend (`strictNullChecks:false`, `noImplicitAny:false`) ni frontend (`strict:false`).
- **C2 — Dockerfiles corren como root** (multi-stage y healthcheck sí, pero sin `USER node`).
- **C3 — nginx sin cabeceras de seguridad** (X-Frame-Options, CSP, HSTS…) y `client_max_body_size 50M` contradice el límite de 100 MB del backend.

### 🟢 Bajo / Positivo (lo que está bien hecho)
- Guards **globales** JWT + Roles (`APP_GUARD`); `ValidationPipe` global con `whitelist + forbidNonWhitelisted`.
- **Verificaciones de propiedad reales** (IDOR) en advances, presentations, thesis-works.status, messages — con tests de regresión.
- `main.ts` **rechaza arrancar en producción con `JWT_SECRET` placeholder** o < 32 chars; **sin secretos hardcodeados**; **ningún `.env` real commiteado**.
- CORS acotado a `FRONTEND_URL`; `bcrypt` en todas las rutas; `forgotPassword` no filtra existencia de cuenta.
- Arquitectura limpia por capas (controller/service/dto), solo 3 `console.log` (todos en bootstrap), sin `@ts-ignore` ni TODOs colgados.
- Estado del frontend bien resuelto (Zustand + React Query + interceptor de refresh).
- **Existe `AUDITORIA_PRODUCCION.md`** con auditoría iterativa real y honesta; se verificó que sus arreglos (IDOR, BAC, migraciones, caché) **sí están en el código**. Lo que **omite**: S1, S2, S3, S4, S6 y C1.

## Uso de `any`
Backend: 56 ocurrencias. Frontend: **220** (el cliente API tipa casi todo como `any`, anulando el tipado end-to-end).

---

## Prioridad de correcciones sugerida

1. **Seguridad primero:** S1 (throttling) → S2 (WS auth) → S3/S4 (authz documents) → C1 (Next.js).
2. **Negocio faltante:** pagos extra (28, 34) → notificación al coordinador (14) y al asesor (23) → reunión+tema definitivo (15-16) → versionado del anteproyecto (19).
3. **Robustez:** transacciones en pagos/estados (S6), validar estado previo en las transiciones que hoy no lo hacen, bug del promedio del jurado.
4. **Endurecimiento:** TS strict, Docker no-root, headers nginx, pruebas unitarias de la lógica de calificación/pagos.
