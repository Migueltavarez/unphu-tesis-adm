# Documentación del proyecto — UNPHU Tesis (entorno local)

> Generada tras clonar, levantar y navegar el proyecto en local el 2026-07-22.
> Complementa al `README.md` con lo aprendido al ponerlo a correr.

## 1. Qué es

Plataforma web para gestionar el ciclo completo de trabajos de grado (tesis y
monográficos) de la Facultad de Ingeniería de la UNPHU: desde la postulación del
estudiante hasta la publicación en el repositorio institucional, pasando por
validación académica, propuesta, pagos (Registro → Cobros → Caja), asignación de
asesor, desarrollo con avances, presentación ante jurado, calificación y edición
colaborativa del documento.

Volumen: ~18.000 líneas de TypeScript entre backend y frontend.

## 2. Arquitectura

```
Navegador ──> Frontend Next.js 14 (App Router)  :3000
                     │  axios → NEXT_PUBLIC_API_URL
                     ▼
             Backend NestJS 10 (REST /api/v1)    :3001
                     │  Prisma ORM
                     ▼
             PostgreSQL 16                        :5433 (Docker)
```

En despliegue con Docker Compose completo, Nginx (:80) hace de reverse proxy y
enruta `/api/*` → backend y el resto → frontend.

| Capa | Tecnología |
|---|---|
| Backend | NestJS 10 + Prisma ORM + PostgreSQL 16 |
| Frontend | Next.js 14 (App Router) + Tailwind + Zustand + React Query |
| Auth | JWT (access 7d + refresh 30d) |
| Documentos | Cloudflare R2 (S3-compatible) — opcional |
| Colaboración | Yjs sobre WebSocket |
| AI | Anthropic SDK (asistente en editor) — opcional |
| Contenedores | Docker Compose + Nginx |

## 3. Módulos del backend (`backend/src/`)

`auth`, `users`, `students`, `advisors`, `careers`, `thesis-works`,
`payments`, `advances`, `meetings`, `presentations`, `repository`,
`notifications`, `messages`, `audit`, `exports`, `templates`, `ai`,
`documents`, `thesis-documents`, `document-nodes`, `blocks`, `collaboration`.

Los tres últimos + `blocks` + `collaboration` forman el **editor de tesis por
nodos/bloques** con versionado y edición colaborativa en tiempo real (Yjs).

- API base: `http://localhost:3001/api/v1`
- Health: `http://localhost:3001/health`
- Swagger: `http://localhost:3001/api/docs` (deshabilitado en `NODE_ENV=production`)

## 4. Modelo de datos (Prisma)

**~30 modelos.** Principales: `User`, `Career`, `Student`, `Advisor`,
`ThesisWork`, `StatusHistory`, `Payment`, `Draft`, `Advance` (+ comentarios),
`Meeting`, `Presentation`, `Grade`, `Document`, `Notification`, `Message`,
`AuditLog`.

Editor colaborativo: `ThesisDocument`, `DocumentNode` (+ historial, comentarios,
versiones), `Block` (+ `BlockVersion`), `NodeRelation`, `DocEvent`,
`DocumentTemplate`, `TemplateNode`.

### Roles (`UserRole`)
`STUDENT`, `ADVISOR`, `COORDINATOR`, `ADMIN`, `EVALUATOR`, `DIRECTOR`,
`REGISTRO`, `COBROS`, `CAJA`, `JURADO`.

### Flujo de estados de una tesis (`ThesisStatus`)
Es el corazón del sistema — un workflow lineal con actor responsable por etapa:

```
POSTULATION → ACADEMIC_VALIDATION → PROPOSAL_FORM → PROPOSAL_REVIEW →
PROPOSAL_APPROVED → REGISTRO_PROCESSING → REGISTERED → COBROS_PROCESSING →
CAJA_PENDING → PAYMENT_CONFIRMED → FACULTY_MEETING → DRAFT_IN_PROGRESS →
DRAFT_UNDER_REVIEW → DRAFT_APPROVED → ADVISOR_ASSIGNED → WORK_STARTED →
IN_DEVELOPMENT → ADVANCES_SUBMITTED → ADVISOR_FEEDBACK → WORK_COMPLETED →
PRESENTATION_SCHEDULED → PRESENTATION_DONE → GRADED → APPROVED → PUBLISHED
```
`REJECTED` puede darse en cualquier etapa. El pago se modela como una cadena de
tres áreas: **Registro** (libera formulario) → **Cobros** (digita monto) →
**Caja** (confirma el pago recibido).

## 5. Frontend (`frontend/src/app/`)

App Router con tres áreas:
- `(auth)/` — login, register, forgot/reset password, verify-email.
- `(dashboard)/dashboard/<rol>/` — un panel por rol: `student`, `advisor`,
  `coordinator`, `director`, `jurado`, `registro`, `cobros`, `caja`, `admin`.
- `repository/` y `repository/[id]` — repositorio público de trabajos publicados
  (accesible sin autenticación).

El estudiante tiene sub-rutas: `thesis`, `proposal`, `advances`, `payment`,
`document` (editor por nodos), `profile`. El coordinador concentra la gestión:
`students`, `advisors`, `works`, `payments`, `templates`, `analytics`.

`middleware.ts` protege las rutas por rol; estado global con Zustand
(`store/`), datos con React Query, cliente HTTP axios en `lib/`.

## 6. Cómo se levantó en local (lo que realmente funcionó)

El `docker-compose.override.yml` está pensado para levantar **solo** la DB en
dev (backend y frontend corren con `npm`). Detalle importante encontrado:

> ⚠️ El servicio `postgres` del compose **no publica puerto**, y en esta
> máquina el 5432 ya estaba ocupado por otro contenedor `postgres`. Se resolvió
> publicando la DB del proyecto en **5433** con un override local no versionado
> (`docker-compose.local.yml`) y apuntando `DATABASE_URL` a `localhost:5433`.

Pasos ejecutados:

```bash
# 1. Base de datos en 5433 (evita choque con otro postgres en 5432)
docker compose -f docker-compose.yml -f docker-compose.override.yml \
               -f docker-compose.local.yml up -d postgres

# 2. Backend
cd backend
cp .env.example .env      # + JWT_SECRET/JWT_REFRESH_SECRET generados con crypto
#   DATABASE_URL=postgresql://unphu_user:unphu_pass_2024@localhost:5433/unphu_tesis_db
npm install
npx prisma generate
npx prisma migrate deploy
npm run db:seed
npm run start:dev         # → :3001

# 3. Frontend
cd ../frontend
echo 'NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1' > .env.local
npm install
npm run dev               # → :3000
```

Notas:
- Node instalado: v24 (el README recomienda 20.x; arrancó sin problemas).
- Prisma Client se fijó en 5.22.0.
- SMTP, R2 y `ANTHROPIC_API_KEY` quedaron como placeholder: esas funciones
  (correo, subida de archivos, asistente AI) están deshabilitadas o devuelven
  error controlado; el resto del sistema opera con normalidad.

### Estado verificado
| Servicio | URL | Estado |
|---|---|---|
| Backend health | http://localhost:3001/health | 200 `{"status":"ok"}` |
| Login API (admin) | POST /api/v1/auth/login | 200 + accessToken JWT |
| Repositorio público (API) | GET /api/v1/repository | 200 |
| Frontend (login) | http://localhost:3000 | 200 — título "UNPHU – Gestión de Trabajos de Grado" |
| Repositorio público (web) | http://localhost:3000/repository | 200 |

## 7. Credenciales de prueba (tras el seed)

| Rol | Email | Contraseña |
|---|---|---|
| Admin | admin@unphu.edu.do | Admin@UNPHU2024 |
| Coordinación | coordinacion.tesis@unphu.edu.do | Coord@UNPHU2024 |
| Asesor | dr.garcia@unphu.edu.do | Asesor@UNPHU2024 |
| Director | director.academico@unphu.edu.do | Director@UNPHU2024 |
| Registro | registro@unphu.edu.do | Registro@UNPHU2024 |
| Cobros | cobros@unphu.edu.do | Cobros@UNPHU2024 |
| Caja | caja@unphu.edu.do | Caja@UNPHU2024 |
| Jurado | jurado1@unphu.edu.do | Jurado@UNPHU2024 |
| Estudiantes | ana.martinez / luis.santos / maria.perez / pedro.diaz @estudiante.unphu.edu.do | Estudiante@2024 |

Los 4 estudiantes están sembrados en distintas etapas del flujo
(IN_DEVELOPMENT, ADVANCES_SUBMITTED, PRESENTATION_SCHEDULED, PENDING_PAYMENT)
para probar cada pantalla. También hay 4 trabajos de grado de ejemplo.

## 8. Pruebas y CI

- Suite E2E del backend (168 tests, según README):
  `npx jest --config test/jest-e2e.json --runInBand` (requiere DB accesible).
- CI vía GitHub Actions (`.github/workflows/ci.yml`).
- Existe `AUDITORIA_PRODUCCION.md` en la raíz con revisión de cara a producción.

## 9. Comandos útiles

| Comando | Carpeta | Descripción |
|---|---|---|
| `npm run start:dev` | backend | Backend en watch |
| `npm run db:studio` | backend | Prisma Studio (explorador visual de la DB) |
| `npm run db:migrate` | backend | Migraciones en dev |
| `npm run db:seed` | backend | Cargar datos semilla |
| `npm run dev` | frontend | Frontend en dev |
| `npm run type-check` | frontend | Verificación de tipos |

## 10. Para apagar / retomar

```bash
# Detener dev servers: matar los procesos npm run start:dev / npm run dev
# Detener la base de datos (mantiene los datos en el volumen):
docker compose -f docker-compose.yml -f docker-compose.override.yml \
               -f docker-compose.local.yml stop postgres
# Retomar: mismo 'up -d postgres' + los start:dev / dev.
```
