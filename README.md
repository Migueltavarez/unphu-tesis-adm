# UNPHU Tesis — Plataforma de Gestión de Trabajos de Grado

Sistema de gestión integral del flujo de trabajos de grado (tesis y monográficos) de la Facultad de Ingeniería de la UNPHU: desde la postulación del estudiante hasta la publicación en el repositorio institucional, pasando por asignación de asesor, pagos, presentación, calificación y edición colaborativa del documento.

## Stack técnico

| Capa | Tecnología |
|---|---|
| Backend | NestJS 10 + Prisma ORM + PostgreSQL 16 |
| Frontend | Next.js 14 (App Router) + Tailwind CSS + Zustand + React Query |
| Autenticación | JWT (access + refresh token) |
| Almacenamiento de documentos | Cloudflare R2 (S3-compatible) |
| Colaboración en tiempo real | Yjs (WebSocket) |
| Contenedores | Docker + Docker Compose + Nginx (reverse proxy) |

## Requisitos previos

- **Node.js** 20.x
- **npm** 10.x
- **PostgreSQL** 16 (local o vía Docker)
- **Docker** y **Docker Compose** (opcional, para despliegue con contenedores)

## Instalación — Desarrollo local

### 1. Clonar el repositorio

```bash
git clone https://github.com/Migueltavarez/unphu-tesis-adm.git
cd unphu-tesis-adm
```

### 2. Levantar PostgreSQL

La forma más simple es con el `docker-compose.override.yml` incluido, que levanta **solo** la base de datos:

```bash
docker compose up -d postgres
```

Alternativamente, usa una instancia de PostgreSQL 16 propia y ajusta `DATABASE_URL` en el paso siguiente.

### 3. Configurar el backend

```bash
cd backend
npm install
cp .env.example .env
```

Edita `backend/.env` y completa como mínimo:

- `DATABASE_URL` — cadena de conexión a PostgreSQL
- `JWT_SECRET` y `JWT_REFRESH_SECRET` — genera valores seguros con:
  ```bash
  node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
  ```

Las variables de SMTP, Cloudflare R2 y `ANTHROPIC_API_KEY` son opcionales en desarrollo: si se dejan como placeholder, esas funciones (envío de correos, carga de archivos, asistente AI) quedan deshabilitadas o devuelven un error controlado, pero el resto del sistema funciona con normalidad.

Aplica las migraciones y carga los datos semilla:

```bash
npm run db:migrate
npm run db:seed
```

Levanta el servidor en modo desarrollo:

```bash
npm run start:dev
```

El backend queda disponible en `http://localhost:3001/api/v1`, con documentación Swagger en `http://localhost:3001/api/docs` (solo fuera de `NODE_ENV=production`).

### 4. Configurar el frontend

En otra terminal:

```bash
cd frontend
npm install
```

Crea `frontend/.env.local` con:

```
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
```

Levanta el servidor de desarrollo:

```bash
npm run dev
```

El frontend queda disponible en `http://localhost:3000`.

### 5. Iniciar sesión

Tras el seed, puedes entrar con cualquiera de estas cuentas (contraseña incluida en el usuario):

| Rol | Email | Contraseña |
|---|---|---|
| Admin | admin@unphu.edu.do | Admin@UNPHU2024 |
| Coordinación | coordinacion.tesis@unphu.edu.do | Coord@UNPHU2024 |
| Asesor | dr.garcia@unphu.edu.do | Asesor@UNPHU2024 |
| Director | director.academico@unphu.edu.do | Director@UNPHU2024 |
| Registro | registro@unphu.edu.do | Registro@UNPHU2024 |
| Cobros | cobros@unphu.edu.do | Cobros@UNPHU2024 |
| Jurado | jurado1@unphu.edu.do | Jurado@UNPHU2024 |

> Cambia estas contraseñas antes de cualquier uso fuera de un entorno de desarrollo local.

## Instalación — Docker Compose (todo el stack)

Para levantar backend, frontend, base de datos y Nginx juntos:

```bash
cp backend/.env.example backend/.env
# edita backend/.env con credenciales reales (ver sección anterior)

docker compose up -d --build
```

Primer arranque — cargar datos semilla dentro del contenedor:

```bash
docker exec unphu_tesis_backend npx prisma db seed
```

La aplicación queda disponible en `http://localhost` (Nginx enruta `/api/*` al backend y el resto al frontend).

> **Antes de usar en producción:** revisa que `JWT_SECRET`/`JWT_REFRESH_SECRET` no sean los valores de ejemplo (el backend rechaza el arranque en `NODE_ENV=production` si detecta el secreto placeholder), configura `NEXT_PUBLIC_API_URL` con el dominio real, y agrega TLS/HTTPS delante de Nginx — el `docker-compose.yml` incluido sirve solo HTTP.

## Pruebas

El backend incluye una suite E2E completa (168 tests) que valida autenticación, flujo de tesis, pagos, presentaciones, repositorio público y casos límite de seguridad.

```bash
cd backend
npx jest --config test/jest-e2e.json --runInBand
```

Requiere una base de datos PostgreSQL accesible vía `DATABASE_URL` (los tests operan contra datos reales y limpian su propio estado).

## Estructura del repositorio

```
.
├── backend/          # API REST NestJS
│   ├── src/          # Módulos (auth, students, thesis-works, payments, ...)
│   ├── prisma/        # Schema, migraciones y seed
│   └── test/          # Suite E2E
├── frontend/          # Aplicación Next.js (App Router)
│   └── src/
│       ├── app/       # Rutas y páginas por rol de usuario
│       ├── lib/        # Cliente API (axios)
│       └── store/      # Estado global (Zustand)
├── nginx/              # Configuración del reverse proxy
└── docker-compose.yml  # Orquestación del stack completo
```

## Scripts útiles

| Comando | Ubicación | Descripción |
|---|---|---|
| `npm run start:dev` | `backend/` | Backend en modo watch |
| `npm run db:studio` | `backend/` | Explorador visual de la base de datos (Prisma Studio) |
| `npm run db:migrate` | `backend/` | Aplica migraciones en desarrollo |
| `npm run dev` | `frontend/` | Frontend en modo desarrollo |
| `npm run type-check` | `frontend/` | Verificación de tipos sin compilar |
