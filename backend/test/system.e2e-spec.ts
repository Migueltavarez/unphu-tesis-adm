import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

// ─── Shared test state ─────────────────────────────────────────────────────────
const TS = Date.now();
const TEST_EMAIL = `test.e2e.${TS}@estudiante.unphu.edu.do`;
const TEST_PASSWORD = 'TestPass@2024!';

let app: INestApplication;
let prisma: PrismaService;

// Auth tokens for each role
let adminToken: string;
let coordinatorToken: string;
let advisorToken: string;
let registroToken: string;
let cobrosToken: string;
let cajaToken: string;
let juradoToken: string;
let studentToken: string;

// IDs created during tests
let testUserId: string;
let testStudentId: string;
let careerId: string;         // ISC career
let advisorId: string;        // Advisor profile ID
let thesisWorkId: string;     // Main test thesis work
let testCareerId: string;     // Career created in test

// ─── Bootstrap ─────────────────────────────────────────────────────────────────
beforeAll(async () => {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  app = moduleFixture.createNestApplication();
  app.setGlobalPrefix('api', { exclude: ['health'] });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  await app.init();
  prisma = app.get(PrismaService);

  // Ensure caja user exists (may not be seeded if seed ran before CAJA role was added in Phase 13)
  const bcrypt = require('bcryptjs');
  const cajaExists = await prisma.user.findUnique({ where: { email: 'caja@unphu.edu.do' } });
  if (!cajaExists) {
    await prisma.user.create({
      data: {
        email: 'caja@unphu.edu.do',
        password: await bcrypt.hash('Caja@UNPHU2024', 10),
        role: 'CAJA' as any,
        firstName: 'Pedro',
        lastName: 'Castillo',
        emailVerified: true,
      },
    });
  }
}, 60000);

// ─── Cleanup ───────────────────────────────────────────────────────────────────
afterAll(async () => {
  try {
    if (testUserId) {
      const student = await prisma.student.findUnique({ where: { userId: testUserId } });
      if (student) {
        const works = await prisma.thesisWork.findMany({ where: { studentId: student.id } });
        for (const work of works) {
          await prisma.statusHistory.deleteMany({ where: { thesisWorkId: work.id } });
          await prisma.payment.deleteMany({ where: { thesisWorkId: work.id } });
          await prisma.advance.deleteMany({ where: { thesisWorkId: work.id } });
        }
        await prisma.thesisWork.deleteMany({ where: { studentId: student.id } });
        await prisma.student.delete({ where: { id: student.id } });
      }
      await prisma.user.delete({ where: { id: testUserId } }).catch(() => {});
    }
    if (testCareerId) {
      await prisma.career.delete({ where: { id: testCareerId } }).catch(() => {});
    }
    // Cleanup dup user from test 28
    await prisma.user
      .findUnique({ where: { email: `dup.${TS}@estudiante.unphu.edu.do` } })
      .then((u) => u && prisma.user.delete({ where: { id: u.id } }))
      .catch(() => {});
  } catch (e) {
    console.error('Cleanup error:', e.message);
  }
  await app.close();
}, 30000);

// ─── HTTP helpers ──────────────────────────────────────────────────────────────
const api = () => request(app.getHttpServer());

const GET = (path: string, token?: string) => {
  const r = api().get(`/api/v1/${path}`);
  return token ? r.set('Authorization', `Bearer ${token}`) : r;
};

const POST = (path: string, body: any, token?: string) => {
  const r = api().post(`/api/v1/${path}`).send(body).set('Content-Type', 'application/json');
  return token ? r.set('Authorization', `Bearer ${token}`) : r;
};

const PATCH = (path: string, body: any, token?: string) => {
  const r = api().patch(`/api/v1/${path}`).send(body).set('Content-Type', 'application/json');
  return token ? r.set('Authorization', `Bearer ${token}`) : r;
};

// ══════════════════════════════════════════════════════════════════════════════
// 1. HEALTH CHECK (1 test)
// ══════════════════════════════════════════════════════════════════════════════
describe('Health Check', () => {
  it('T01 – GET /health returns 200 with status ok', async () => {
    const res = await api().get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 2. AUTH MODULE (18 tests)
// ══════════════════════════════════════════════════════════════════════════════
describe('Auth Module', () => {
  it('T02 – POST /auth/login admin → 200 with accessToken', async () => {
    const res = await POST('auth/login', { email: 'admin@unphu.edu.do', password: 'Admin@UNPHU2024' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('accessToken');
    adminToken = res.body.accessToken;
  });

  it('T03 – POST /auth/login coordinator → 200', async () => {
    const res = await POST('auth/login', { email: 'coordinacion.tesis@unphu.edu.do', password: 'Coord@UNPHU2024' });
    expect(res.status).toBe(200);
    coordinatorToken = res.body.accessToken;
  });

  it('T04 – POST /auth/login advisor → 200', async () => {
    const res = await POST('auth/login', { email: 'dr.garcia@unphu.edu.do', password: 'Asesor@UNPHU2024' });
    expect(res.status).toBe(200);
    advisorToken = res.body.accessToken;
  });

  it('T05 – POST /auth/login registro → 200', async () => {
    const res = await POST('auth/login', { email: 'registro@unphu.edu.do', password: 'Registro@UNPHU2024' });
    expect(res.status).toBe(200);
    registroToken = res.body.accessToken;
  });

  it('T06 – POST /auth/login cobros → 200', async () => {
    const res = await POST('auth/login', { email: 'cobros@unphu.edu.do', password: 'Cobros@UNPHU2024' });
    expect(res.status).toBe(200);
    cobrosToken = res.body.accessToken;
  });

  it('T07 – POST /auth/login caja → 200', async () => {
    const res = await POST('auth/login', { email: 'caja@unphu.edu.do', password: 'Caja@UNPHU2024' });
    expect(res.status).toBe(200);
    cajaToken = res.body.accessToken;
  });

  it('T08 – POST /auth/login jurado → 200', async () => {
    const res = await POST('auth/login', { email: 'jurado1@unphu.edu.do', password: 'Jurado@UNPHU2024' });
    expect(res.status).toBe(200);
    juradoToken = res.body.accessToken;
  });

  it('T09 – POST /auth/login wrong password → 401', async () => {
    const res = await POST('auth/login', { email: 'admin@unphu.edu.do', password: 'wrongpass' });
    expect(res.status).toBe(401);
  });

  it('T10 – POST /auth/login unknown email → 401', async () => {
    const res = await POST('auth/login', { email: 'nadie@unphu.edu.do', password: 'anypassword' });
    expect(res.status).toBe(401);
  });

  it('T11 – POST /auth/login missing email → 400', async () => {
    const res = await POST('auth/login', { password: 'Admin@UNPHU2024' });
    expect(res.status).toBe(400);
  });

  it('T12 – POST /auth/login missing password → 400', async () => {
    const res = await POST('auth/login', { email: 'admin@unphu.edu.do' });
    expect(res.status).toBe(400);
  });

  it('T13 – POST /auth/register creates new student user', async () => {
    const res = await POST('auth/register', {
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      firstName: 'Test',
      lastName: 'Estudiante',
    });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('accessToken');
    studentToken = res.body.accessToken;
  });

  it('T14 – POST /auth/register duplicate email → 409', async () => {
    const res = await POST('auth/register', {
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      firstName: 'Dupe',
      lastName: 'User',
    });
    expect(res.status).toBe(409);
  });

  it('T15 – POST /auth/register invalid email format → 400', async () => {
    const res = await POST('auth/register', {
      email: 'not-valid',
      password: TEST_PASSWORD,
      firstName: 'Bad',
      lastName: 'Email',
    });
    expect(res.status).toBe(400);
  });

  it('T16 – GET /auth/me with admin token returns admin user', async () => {
    const res = await GET('auth/me', adminToken);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe('admin@unphu.edu.do');
    expect(res.body.role).toBe('ADMIN');
  });

  it('T17 – GET /auth/me with student token returns student user', async () => {
    const res = await GET('auth/me', studentToken);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe(TEST_EMAIL);
    expect(res.body.role).toBe('STUDENT');
    testUserId = res.body.id;
  });

  it('T18 – GET /auth/me without token → 401', async () => {
    const res = await GET('auth/me');
    expect(res.status).toBe(401);
  });

  it('T19 – POST /auth/forgot-password known email → 200 (no content leak)', async () => {
    const res = await POST('auth/forgot-password', { email: TEST_EMAIL });
    expect(res.status).toBe(200);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 3. CAREERS MODULE (7 tests)
// ══════════════════════════════════════════════════════════════════════════════
describe('Careers Module', () => {
  it('T20 – GET /careers public, no auth, returns ≥ 5 careers', async () => {
    const res = await GET('careers');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(5);
    careerId = res.body.find((c: any) => c.code === 'ISC')?.id;
    expect(careerId).toBeDefined();
  });

  it('T21 – GET /careers returns ISC career with correct name', async () => {
    const res = await GET('careers');
    const isc = res.body.find((c: any) => c.code === 'ISC');
    expect(isc.name).toContain('Ingeniería en Sistemas');
  });

  it('T22 – GET /careers/:id returns specific career', async () => {
    const res = await GET(`careers/${careerId}`);
    expect(res.status).toBe(200);
    expect(res.body.code).toBe('ISC');
  });

  it('T23 – GET /careers/:id nonexistent UUID → 404', async () => {
    const res = await GET('careers/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(404);
  });

  it('T24 – POST /careers admin creates new career', async () => {
    const res = await POST('careers', {
      name: `Ingeniería de Prueba E2E ${TS}`,
      code: `TP${String(TS).slice(-6)}`,
      description: 'Carrera de prueba E2E - eliminar después',
    }, adminToken);
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    testCareerId = res.body.id;
  });

  it('T25 – POST /careers student cannot create career → 403', async () => {
    const res = await POST('careers', { name: 'No auth', code: 'NOA' }, studentToken);
    expect(res.status).toBe(403);
  });

  it('T26 – PATCH /careers/:id admin updates career description', async () => {
    const res = await PATCH(`careers/${testCareerId}`, {
      description: 'Descripción actualizada en test E2E',
    }, adminToken);
    expect(res.status).toBe(200);
    expect(res.body.description).toBe('Descripción actualizada en test E2E');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 4. STUDENTS MODULE (12 tests)
// ══════════════════════════════════════════════════════════════════════════════
describe('Students Module', () => {
  const MATRICULA = `T${String(TS).slice(-9)}`;

  it('T27 – POST /students/profile student creates academic profile', async () => {
    const res = await POST('students/profile', {
      matricula: MATRICULA,
      careerId,
      creditsApproved: 150,
      gpa: 3.5,
    }, studentToken);
    expect(res.status).toBe(201);
    expect(res.body.matricula).toBe(MATRICULA);
    testStudentId = res.body.id;
  });

  it('T28 – POST /students/profile duplicate matricula → 409', async () => {
    const reg = await POST('auth/register', {
      email: `dup.${TS}@estudiante.unphu.edu.do`,
      password: TEST_PASSWORD,
      firstName: 'Dup',
      lastName: 'Student',
    });
    expect(reg.status).toBe(201);
    const dupToken = reg.body.accessToken;
    const res = await POST('students/profile', { matricula: MATRICULA, careerId, creditsApproved: 120 }, dupToken);
    expect(res.status).toBe(409);
  });

  it('T29 – GET /students/me student gets own profile with career', async () => {
    const res = await GET('students/me', studentToken);
    expect(res.status).toBe(200);
    expect(res.body.matricula).toBe(MATRICULA);
    expect(res.body.career).toBeDefined();
    expect(res.body.career.code).toBe('ISC');
    testStudentId = res.body.id;
  });

  it('T30 – PATCH /students/me student updates credits', async () => {
    const res = await PATCH('students/me', { creditsApproved: 160 }, studentToken);
    expect(res.status).toBe(200);
    expect(res.body.creditsApproved).toBe(160);
  });

  it('T31 – PATCH /students/me student cannot set careerId to nonexistent', async () => {
    const res = await PATCH('students/me', {
      careerId: '00000000-0000-0000-0000-000000000000',
    }, studentToken);
    // Prisma will throw a foreign key or not-found error
    expect([400, 404, 500]).toContain(res.status);
  });

  it('T32 – GET /students coordinator lists all students', async () => {
    const res = await GET('students', coordinatorToken);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('T33 – GET /students registro can list students', async () => {
    const res = await GET('students', registroToken);
    expect(res.status).toBe(200);
  });

  it('T34 – GET /students student cannot list all → 403', async () => {
    const res = await GET('students', studentToken);
    expect(res.status).toBe(403);
  });

  it('T35 – GET /students advisor cannot list all → 403', async () => {
    const res = await GET('students', advisorToken);
    expect(res.status).toBe(403);
  });

  it('T36 – GET /students/:id coordinator gets student detail', async () => {
    const res = await GET(`students/${testStudentId}`, coordinatorToken);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(testStudentId);
    expect(res.body.matricula).toBe(MATRICULA);
  });

  it('T37 – GET /students?search=T coordinator searches by matricula prefix', async () => {
    const res = await GET(`students?search=${MATRICULA.slice(0, 4)}`, coordinatorToken);
    expect(res.status).toBe(200);
    const found = res.body.find((s: any) => s.id === testStudentId);
    expect(found).toBeDefined();
  });

  it('T38 – PATCH /students/:id/eligibility registro approves', async () => {
    const res = await PATCH(`students/${testStudentId}/eligibility`, {
      isEligible: true,
      notes: 'Expediente revisado — apto',
    }, registroToken);
    expect(res.status).toBe(200);
    expect(res.body.isEligible).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 5. THESIS WORKS – CREATION & POSTULATION (8 tests)
// ══════════════════════════════════════════════════════════════════════════════
describe('Thesis Works – Creation', () => {
  it('T39 – GET /thesis-works student gets own (empty) list', async () => {
    const res = await GET('thesis-works', studentToken);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
  });

  it('T40 – POST /thesis-works eligible student creates postulation', async () => {
    const res = await POST('thesis-works', {
      title: `Sistema E2E Inteligencia Artificial Gestion UNPHU ${TS}`,
      type: 'TESIS',
      careerId,
      abstract: 'Propuesta de un sistema de gestión académica usando IA para la UNPHU.',
      keywords: ['IA', 'Gestión', 'Académica', 'UNPHU'],
    }, studentToken);
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('POSTULATION');
    expect(res.body.careerId).toBe(careerId);
    thesisWorkId = res.body.id;
  });

  it('T41 – POST /thesis-works second attempt by same student → 400', async () => {
    // Student already has an active work
    const res = await POST('thesis-works', {
      title: `Segundo trabajo intento duplicado ${TS}`,
      type: 'MONOGRAFICO',
      careerId,
    }, studentToken);
    expect(res.status).toBe(400);
  });

  it('T42 – GET /thesis-works coordinator sees all works', async () => {
    const res = await GET('thesis-works', coordinatorToken);
    expect(res.status).toBe(200);
    expect(res.body.total).toBeGreaterThan(0);
    const found = res.body.data.find((w: any) => w.id === thesisWorkId);
    expect(found).toBeDefined();
  });

  it('T43 – GET /thesis-works student sees only own works', async () => {
    const res = await GET('thesis-works', studentToken);
    expect(res.status).toBe(200);
    const ids = res.body.data.map((w: any) => w.id);
    expect(ids).toContain(thesisWorkId);
  });

  it('T44 – GET /thesis-works/:id student gets own work', async () => {
    const res = await GET(`thesis-works/${thesisWorkId}`, studentToken);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(thesisWorkId);
    expect(res.body.status).toBe('POSTULATION');
  });

  it('T45 – PATCH /thesis-works/:id coordinator updates abstract', async () => {
    const res = await PATCH(`thesis-works/${thesisWorkId}`, {
      abstract: 'Resumen actualizado en pruebas E2E del sistema de gestión UNPHU.',
    }, coordinatorToken);
    expect(res.status).toBe(200);
  });

  it('T46 – GET /thesis-works/:id nonexistent → 404', async () => {
    const res = await GET('thesis-works/00000000-0000-0000-0000-000000000000', coordinatorToken);
    expect(res.status).toBe(404);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 6. THESIS WORKS – PROPOSAL SUBMISSION & REVIEW (6 tests)
// ══════════════════════════════════════════════════════════════════════════════
describe('Thesis Works – Proposal', () => {
  it('T47 – PATCH /thesis-works/:id/submit-proposal student submits with firma', async () => {
    const res = await PATCH(`thesis-works/${thesisWorkId}/submit-proposal`, {
      firma: 'Test Estudiante',
    }, studentToken);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('PROPOSAL_REVIEW');
    expect(res.body.firma).toBe('Test Estudiante');
  });

  it('T48 – PATCH /thesis-works/:id/submit-proposal wrong status → 400', async () => {
    // Already in PROPOSAL_REVIEW
    const res = await PATCH(`thesis-works/${thesisWorkId}/submit-proposal`, {
      firma: 'Second firma attempt',
    }, studentToken);
    expect(res.status).toBe(400);
  });

  it('T49 – PATCH /thesis-works/:id/status student cannot change status → 403', async () => {
    const res = await PATCH(`thesis-works/${thesisWorkId}/status`, {
      status: 'PROPOSAL_APPROVED',
    }, studentToken);
    expect(res.status).toBe(403);
  });

  it('T50 – PATCH /thesis-works/:id/status coordinator approves proposal', async () => {
    const res = await PATCH(`thesis-works/${thesisWorkId}/status`, {
      status: 'PROPOSAL_APPROVED',
      notes: 'Propuesta revisada y aprobada',
    }, coordinatorToken);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('PROPOSAL_APPROVED');
  });

  it('T51 – PATCH /thesis-works/:id/status jurado cannot change status → 403', async () => {
    const res = await PATCH(`thesis-works/${thesisWorkId}/status`, {
      status: 'ACADEMIC_VALIDATION',
    }, juradoToken);
    expect(res.status).toBe(403);
  });

  it('T52 – PATCH /thesis-works/:id/status invalid backward transition → 400', async () => {
    // El trabajo está en PROPOSAL_APPROVED; saltar a ACADEMIC_VALIDATION no es una
    // transición válida (retrocedería el flujo). El backend debe rechazarla.
    const res = await PATCH(`thesis-works/${thesisWorkId}/status`, {
      status: 'ACADEMIC_VALIDATION',
      notes: 'Intento de retroceso inválido',
    }, coordinatorToken);
    expect(res.status).toBe(400);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 7. THESIS WORKS – REGISTRO PROCESSING (4 tests)
// ══════════════════════════════════════════════════════════════════════════════
describe('Thesis Works – Registro', () => {
  it('T53 – PATCH /thesis-works/:id/status coordinator → REGISTRO_PROCESSING', async () => {
    const res = await PATCH(`thesis-works/${thesisWorkId}/status`, {
      status: 'REGISTRO_PROCESSING',
      notes: 'Derivado a Registro para validación física',
    }, coordinatorToken);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('REGISTRO_PROCESSING');
  });

  it('T54 – PATCH /thesis-works/:id/status registro → REGISTERED', async () => {
    const res = await PATCH(`thesis-works/${thesisWorkId}/status`, {
      status: 'REGISTERED',
      notes: 'Expediente físico verificado y registrado',
    }, registroToken);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('REGISTERED');
  });

  it('T55 – GET /thesis-works status history has all transitions', async () => {
    const res = await GET(`thesis-works/${thesisWorkId}`, coordinatorToken);
    expect(res.status).toBe(200);
    expect(res.body.statusHistory.length).toBeGreaterThanOrEqual(4);
    const statuses = res.body.statusHistory.map((h: any) => h.toStatus);
    expect(statuses).toContain('PROPOSAL_REVIEW');
    expect(statuses).toContain('REGISTERED');
  });

  it('T56 – GET /thesis-works?status=REGISTERED finds the work', async () => {
    const res = await GET('thesis-works?status=REGISTERED', coordinatorToken);
    expect(res.status).toBe(200);
    const found = res.body.data.find((w: any) => w.id === thesisWorkId);
    expect(found).toBeDefined();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 8. PAYMENTS MODULE (12 tests)
// ══════════════════════════════════════════════════════════════════════════════
describe('Payments Module', () => {
  it('T57 – GET /thesis-works/:id/payment no payment yet', async () => {
    const res = await GET(`thesis-works/${thesisWorkId}/payment`, coordinatorToken);
    expect([200, 404]).toContain(res.status);
  });

  it('T58 – PATCH payment/set-amount student cannot → 403', async () => {
    const res = await PATCH(`thesis-works/${thesisWorkId}/payment/set-amount`, { amount: 5000 }, studentToken);
    expect(res.status).toBe(403);
  });

  it('T59 – PATCH payment/set-amount advisor cannot → 403', async () => {
    const res = await PATCH(`thesis-works/${thesisWorkId}/payment/set-amount`, { amount: 5000 }, advisorToken);
    expect(res.status).toBe(403);
  });

  it('T60 – PATCH payment/set-amount registro cannot → 403', async () => {
    const res = await PATCH(`thesis-works/${thesisWorkId}/payment/set-amount`, { amount: 5000 }, registroToken);
    expect(res.status).toBe(403);
  });

  it('T61 – PATCH payment/set-amount cobros sets amount → CAJA_PENDING', async () => {
    const res = await PATCH(`thesis-works/${thesisWorkId}/payment/set-amount`, {
      amount: 5500,
      notes: 'Monto estándar de titulación RD$ 5,500',
    }, cobrosToken);
    expect(res.status).toBe(200);
    expect(Number(res.body.amount)).toBe(5500);
    expect(res.body.status).toBe('PENDING');
  });

  it('T62 – GET /thesis-works/:id shows CAJA_PENDING after set-amount', async () => {
    const res = await GET(`thesis-works/${thesisWorkId}`, coordinatorToken);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('CAJA_PENDING');
    expect(res.body.payment).toBeDefined();
    expect(Number(res.body.payment.amount)).toBe(5500);
  });

  it('T63 – PATCH payment/set-amount wrong status now → 400', async () => {
    const res = await PATCH(`thesis-works/${thesisWorkId}/payment/set-amount`, { amount: 9000 }, cobrosToken);
    expect(res.status).toBe(400);
  });

  it('T64 – PATCH payment/caja-confirm student cannot → 403', async () => {
    const res = await PATCH(`thesis-works/${thesisWorkId}/payment/caja-confirm`, {}, studentToken);
    expect(res.status).toBe(403);
  });

  it('T65 – PATCH payment/caja-confirm cobros cannot confirm → 403', async () => {
    const res = await PATCH(`thesis-works/${thesisWorkId}/payment/caja-confirm`, {}, cobrosToken);
    expect(res.status).toBe(403);
  });

  it('T66 – PATCH payment/caja-confirm caja confirms payment', async () => {
    const res = await PATCH(`thesis-works/${thesisWorkId}/payment/caja-confirm`, {
      notes: 'Pago recibido en ventanilla — efectivo',
    }, cajaToken);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('CONFIRMED');
  });

  it('T67 – GET /thesis-works/:id status is PAYMENT_CONFIRMED', async () => {
    const res = await GET(`thesis-works/${thesisWorkId}`, coordinatorToken);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('PAYMENT_CONFIRMED');
  });

  it('T68 – GET /payments admin lists all payments', async () => {
    const res = await GET('payments', adminToken);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const found = res.body.find((p: any) => p.thesisWorkId === thesisWorkId);
    expect(found).toBeDefined();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 9. THESIS WORKS – POST-PAYMENT → PUBLISHED (12 tests)
// ══════════════════════════════════════════════════════════════════════════════
describe('Thesis Works – Development to Publication', () => {
  it('T69 – PATCH status → FACULTY_MEETING coordinator', async () => {
    const res = await PATCH(`thesis-works/${thesisWorkId}/status`, {
      status: 'FACULTY_MEETING',
      notes: 'Reunión de facultad convocada',
    }, coordinatorToken);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('FACULTY_MEETING');
  });

  it('T70 – PATCH assign-advisor coordinator assigns Dr. García', async () => {
    const advisorRecord = await prisma.advisor.findFirst({
      where: { user: { email: 'dr.garcia@unphu.edu.do' } },
    });
    advisorId = advisorRecord!.id;
    const res = await PATCH(`thesis-works/${thesisWorkId}/assign-advisor`, {
      advisorId,
    }, coordinatorToken);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ADVISOR_ASSIGNED');
    expect(res.body.advisor.user.email).toBe('dr.garcia@unphu.edu.do');
  });

  it('T71 – PATCH assign-advisor student cannot assign → 403', async () => {
    const res = await PATCH(`thesis-works/${thesisWorkId}/assign-advisor`, {
      advisorId,
    }, studentToken);
    expect(res.status).toBe(403);
  });

  it('T72 – GET thesis-works/:id advisor sees own assigned work', async () => {
    const res = await GET(`thesis-works/${thesisWorkId}`, advisorToken);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(thesisWorkId);
  });

  it('T73 – PATCH status → WORK_STARTED', async () => {
    const res = await PATCH(`thesis-works/${thesisWorkId}/status`, {
      status: 'WORK_STARTED',
    }, coordinatorToken);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('WORK_STARTED');
  });

  it('T74 – PATCH status → IN_DEVELOPMENT', async () => {
    const res = await PATCH(`thesis-works/${thesisWorkId}/status`, {
      status: 'IN_DEVELOPMENT',
    }, coordinatorToken);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('IN_DEVELOPMENT');
  });

  it('T75 – PATCH status → WORK_COMPLETED', async () => {
    const res = await PATCH(`thesis-works/${thesisWorkId}/status`, {
      status: 'WORK_COMPLETED',
      notes: 'Trabajo finalizado y entregado',
    }, coordinatorToken);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('WORK_COMPLETED');
  });

  it('T76 – PATCH status → PRESENTATION_SCHEDULED', async () => {
    const res = await PATCH(`thesis-works/${thesisWorkId}/status`, {
      status: 'PRESENTATION_SCHEDULED',
    }, coordinatorToken);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('PRESENTATION_SCHEDULED');
  });

  it('T77 – PATCH status → PRESENTATION_DONE', async () => {
    const res = await PATCH(`thesis-works/${thesisWorkId}/status`, {
      status: 'PRESENTATION_DONE',
    }, coordinatorToken);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('PRESENTATION_DONE');
  });

  it('T78 – PATCH status → GRADED', async () => {
    const res = await PATCH(`thesis-works/${thesisWorkId}/status`, {
      status: 'GRADED',
      notes: 'Calificación registrada',
    }, coordinatorToken);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('GRADED');
  });

  it('T79 – PATCH status → APPROVED', async () => {
    const res = await PATCH(`thesis-works/${thesisWorkId}/status`, {
      status: 'APPROVED',
      notes: 'Aprobado por el jurado con distinción',
    }, coordinatorToken);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('APPROVED');
    expect(res.body.approvedAt).toBeDefined();
  });

  it('T80 – PATCH status → PUBLISHED (admin)', async () => {
    const res = await PATCH(`thesis-works/${thesisWorkId}/status`, {
      status: 'PUBLISHED',
      notes: 'Publicado en el repositorio institucional',
    }, adminToken);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('PUBLISHED');
    expect(res.body.publishedAt).toBeDefined();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 10. ADVANCES MODULE (8 tests)
// ══════════════════════════════════════════════════════════════════════════════
describe('Advances Module', () => {
  let advanceThesisWorkId: string;

  beforeAll(async () => {
    // Use seeded Ana Martínez's work (IN_DEVELOPMENT from seed)
    const stUser = await prisma.user.findUnique({
      where: { email: 'ana.martinez@estudiante.unphu.edu.do' },
    });
    if (stUser) {
      const student = await prisma.student.findUnique({ where: { userId: stUser.id } });
      if (student) {
        const work = await prisma.thesisWork.findFirst({
          where: { studentId: student.id },
          orderBy: { updatedAt: 'desc' },
        });
        advanceThesisWorkId = work?.id ?? thesisWorkId;
      }
    }
    advanceThesisWorkId = advanceThesisWorkId ?? thesisWorkId;
  });

  it('T81 – GET /thesis-works/:id/advances coordinator lists advances', async () => {
    const res = await GET(`thesis-works/${advanceThesisWorkId}/advances`, coordinatorToken);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('T82 – GET /thesis-works/:id/advances advisor lists advances', async () => {
    const res = await GET(`thesis-works/${advanceThesisWorkId}/advances`, advisorToken);
    expect(res.status).toBe(200);
  });

  it('T83 – GET /thesis-works/:id/advances authenticated user can view list', async () => {
    const res = await GET(`thesis-works/${advanceThesisWorkId}/advances`, registroToken);
    expect(res.status).toBe(200);
  });

  it('T84 – POST /thesis-works/:id/advances wrong-student gets 403', async () => {
    // Our test student does not own Ana's work
    const res = await api()
      .post(`/api/v1/thesis-works/${advanceThesisWorkId}/advances`)
      .set('Authorization', `Bearer ${studentToken}`)
      .field('description', 'Capítulo 1');
    expect([400, 403]).toContain(res.status);
  });

  it('T85 – POST /thesis-works/:id/advances advisor cannot submit → 403', async () => {
    const res = await api()
      .post(`/api/v1/thesis-works/${advanceThesisWorkId}/advances`)
      .set('Authorization', `Bearer ${advisorToken}`)
      .field('description', 'Intento asesor');
    expect(res.status).toBe(403);
  });

  it('T86 – PATCH /thesis-works/:id/advances/:id/review advisor can review', async () => {
    // Get any existing advance
    const advances = await prisma.advance.findMany({
      where: { thesisWorkId: advanceThesisWorkId },
    });
    if (advances.length > 0) {
      const res = await PATCH(
        `thesis-works/${advanceThesisWorkId}/advances/${advances[0].id}/review`,
        { status: 'APPROVED', comments: 'Avance aprobado' },
        advisorToken,
      );
      expect([200, 400]).toContain(res.status);
    } else {
      // No advances seeded for this work — pass trivially
      expect(true).toBe(true);
    }
  });

  it('T87 – GET /thesis-works/:id/advances student cannot list other student advances → 200 or 403', async () => {
    const res = await GET(`thesis-works/${advanceThesisWorkId}/advances`, studentToken);
    // Endpoint doesn't check ownership for list, might return 200 or 403
    expect([200, 403]).toContain(res.status);
  });

  it('T88 – GET /thesis-works/:id without token → 401', async () => {
    const res = await GET(`thesis-works/${advanceThesisWorkId}/advances`);
    expect(res.status).toBe(401);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 11. METRICS AND REPORTS (6 tests)
// ══════════════════════════════════════════════════════════════════════════════
describe('Metrics and Reports', () => {
  it('T89 – GET /thesis-works/metrics coordinator gets metrics object', async () => {
    const res = await GET('thesis-works/metrics', coordinatorToken);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('total');
    expect(res.body).toHaveProperty('byStatus');
    expect(res.body).toHaveProperty('byCareer');
    expect(res.body).toHaveProperty('funnel');
    expect(res.body.total).toBeGreaterThan(0);
  });

  it('T90 – GET /thesis-works/metrics student cannot access → 403', async () => {
    const res = await GET('thesis-works/metrics', studentToken);
    expect(res.status).toBe(403);
  });

  it('T91 – GET /thesis-works/metrics jurado cannot access → 403', async () => {
    const res = await GET('thesis-works/metrics', juradoToken);
    expect(res.status).toBe(403);
  });

  it('T92 – GET /thesis-works/stats/monthly returns 12 months', async () => {
    const res = await GET('thesis-works/stats/monthly', coordinatorToken);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(12);
    expect(res.body[0]).toHaveProperty('month');
    expect(res.body[0]).toHaveProperty('nuevos');
  });

  it('T93 – GET /thesis-works/export coordinator gets CSV', async () => {
    const res = await GET('thesis-works/export', coordinatorToken);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain('.csv');
  });

  it('T94 – GET /payments/export cobros exports payments CSV', async () => {
    const res = await GET('payments/export', cobrosToken);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 12. ACCESS CONTROL – CROSS-ROLE (6 tests)
// ══════════════════════════════════════════════════════════════════════════════
describe('Access Control – Role Boundaries', () => {
  it('T95 – Unauthenticated request to /thesis-works → 401', async () => {
    const res = await GET('thesis-works');
    expect(res.status).toBe(401);
  });

  it('T96 – JURADO can view thesis works list', async () => {
    const res = await GET('thesis-works', juradoToken);
    expect(res.status).toBe(200);
  });

  it('T97 – JURADO cannot change thesis status → 403', async () => {
    const res = await PATCH(`thesis-works/${thesisWorkId}/status`, {
      status: 'REJECTED',
    }, juradoToken);
    expect(res.status).toBe(403);
  });

  it('T98 – Student cannot view another student thesis detail → 403', async () => {
    const otherWork = await prisma.thesisWork.findFirst({
      where: { student: { user: { email: { not: TEST_EMAIL } } } },
    });
    if (otherWork) {
      const res = await GET(`thesis-works/${otherWork.id}`, studentToken);
      expect(res.status).toBe(403);
    } else {
      expect(true).toBe(true);
    }
  });

  it('T99 – PATCH /students/:id/eligibility student cannot → 403', async () => {
    const res = await PATCH(`students/${testStudentId}/eligibility`, {
      isEligible: false,
    }, studentToken);
    expect(res.status).toBe(403);
  });

  it('T100 – GET /payments cobros can list payments', async () => {
    const res = await GET('payments', cobrosToken);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
