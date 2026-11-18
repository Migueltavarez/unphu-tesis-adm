// ════════════════════════════════════════════════════════════════════════════
// Prórrogas (solicitud → aval del asesor → Coordinación, con escalamiento) y
// cambio de asesor (hereda el historial; queda registrado).
//
// Usa el trabajo semilla de Ana Martínez y crea un asesor temporal. Todo se
// restaura al terminar (estado, asesor, fechas de hitos, registros creados).
// El envío de correo está simulado.
// ════════════════════════════════════════════════════════════════════════════
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import * as request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { ThesisStatus, UserRole } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { NotificationsService } from '../src/notifications/notifications.service';
import { ExtensionsService } from '../src/extensions/extensions.service';
import { EXTENSION_RULES } from '../src/extensions/extension.rules';

let app: INestApplication;
let prisma: PrismaService;
const emailSpy = jest.spyOn(NotificationsService.prototype, 'sendEmail').mockResolvedValue(undefined);

const T0 = new Date();
const TS = Date.now();
const TMP_EMAIL = `asesor.temporal.${TS}@unphu.edu.do`;
const DAY = 86_400_000;
let workId: string;
let original: { status: ThesisStatus; advisorId: string | null };
let originalDue: Map<string, Date>;
let garciaAdvisorId: string;
let tmpAdvisorId: string;
let tmpUserId: string;
let anaUserId: string;
const tokens: Record<string, string> = {};
let extId: string;

const api = () => request(app.getHttpServer());
const auth = (r: request.Test, who: string) => r.set('Authorization', `Bearer ${tokens[who]}`);
const GET = (p: string, who: string) => auth(api().get(`/api/v1/${p}`), who);
const POST = (p: string, body: any, who: string) => auth(api().post(`/api/v1/${p}`).send(body), who);
const PATCH = (p: string, body: any, who: string) => auth(api().patch(`/api/v1/${p}`).send(body), who);
const REASON = 'Estuve hospitalizado tres semanas y perdí el acceso al laboratorio de datos del banco.';

beforeAll(async () => {
  const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleFixture.createNestApplication();
  app.setGlobalPrefix('api', { exclude: ['health'] });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true, forbidNonWhitelisted: true, transform: true,
    transformOptions: { enableImplicitConversion: true },
  }));
  await app.init();
  prisma = app.get(PrismaService);

  // Asesor temporal (para el cambio de asesor).
  const tmp = await prisma.user.create({
    data: {
      email: TMP_EMAIL, password: await bcrypt.hash('Temporal@2024', 10), role: UserRole.ADVISOR,
      firstName: 'Laura', lastName: 'Temporal', emailVerified: true,
      advisor: { create: { department: 'Sistemas', specialties: [], maxWorkload: 5 } },
    },
    include: { advisor: true },
  });
  tmpUserId = tmp.id;
  tmpAdvisorId = tmp.advisor!.id;

  const login = async (who: string, email: string, password: string) => {
    tokens[who] = (await api().post('/api/v1/auth/login').send({ email, password })).body.accessToken;
  };
  await login('ana', 'ana.martinez@estudiante.unphu.edu.do', 'Estudiante@2024');
  await login('maria', 'maria.perez@estudiante.unphu.edu.do', 'Estudiante@2024');
  await login('advisor', 'dr.garcia@unphu.edu.do', 'Asesor@UNPHU2024');
  await login('coord', 'coordinacion.tesis@unphu.edu.do', 'Coord@UNPHU2024');
  await login('tmp', TMP_EMAIL, 'Temporal@2024');

  const ana = await prisma.user.findUniqueOrThrow({ where: { email: 'ana.martinez@estudiante.unphu.edu.do' }, include: { student: true } });
  anaUserId = ana.id;
  garciaAdvisorId = (await prisma.advisor.findFirstOrThrow({ where: { user: { email: 'dr.garcia@unphu.edu.do' } } })).id;
  const work = await prisma.thesisWork.findFirstOrThrow({ where: { studentId: ana.student!.id }, orderBy: { updatedAt: 'desc' } });
  workId = work.id;
  original = { status: work.status, advisorId: work.advisorId };
  await prisma.thesisWork.update({ where: { id: workId }, data: { status: ThesisStatus.IN_DEVELOPMENT, advisorId: garciaAdvisorId } });

  // Asegura los hitos (los genera la app al consultarlos) y guarda sus fechas.
  await GET(`thesis-works/${workId}/milestones`, 'coord');
  const ms = await prisma.milestone.findMany({ where: { thesisWorkId: workId } });
  originalDue = new Map(ms.map((m) => [m.id, m.dueDate]));
}, 60000);

afterAll(async () => {
  try {
    // updatedAt también: X9 retrocede createdAt para simular el escalamiento.
    await prisma.extensionRequest.deleteMany({
      where: { thesisWorkId: workId, OR: [{ createdAt: { gte: T0 } }, { updatedAt: { gte: T0 } }] },
    });
    await prisma.advisorChange.deleteMany({ where: { thesisWorkId: workId, createdAt: { gte: T0 } } });
    for (const [id, dueDate] of originalDue) await prisma.milestone.update({ where: { id }, data: { dueDate } });
    await prisma.thesisWork.update({ where: { id: workId }, data: { status: original.status, advisorId: original.advisorId } });
    await prisma.notification.deleteMany({ where: { createdAt: { gte: T0 }, metadata: { path: ['thesisWorkId'], equals: workId } } });
    await prisma.auditLog.deleteMany({ where: { createdAt: { gte: T0 }, entity: { in: ['ExtensionRequest', 'ThesisWork.advisor'] } } });
    await prisma.notification.deleteMany({ where: { userId: tmpUserId } });
    await prisma.auditLog.deleteMany({ where: { userId: tmpUserId } });
    await prisma.advisor.delete({ where: { id: tmpAdvisorId } }).catch(() => undefined);
    await prisma.user.delete({ where: { id: tmpUserId } }).catch(() => undefined);
  } finally {
    emailSpy.mockRestore();
    await app.close();
  }
}, 30000);

describe('Prórrogas', () => {
  it('X1 – acceso: otra estudiante no ve las prórrogas; la dueña puede solicitar', async () => {
    expect((await GET(`thesis-works/${workId}/extensions`, 'maria')).status).toBe(403);
    const res = await GET(`thesis-works/${workId}/extensions`, 'ana');
    expect(res.status).toBe(200);
    expect(res.body.canRequest).toBe(true);
  });

  it('X2 – la solicitud debe estar justificada y dentro del rango', async () => {
    expect((await POST(`thesis-works/${workId}/extensions`, { days: 30, reason: 'Corto' }, 'ana')).status).toBe(400);
    expect((await POST(`thesis-works/${workId}/extensions`, { days: 0, reason: REASON }, 'ana')).status).toBe(400);
    expect((await POST(`thesis-works/${workId}/extensions`, { days: 500, reason: REASON }, 'ana')).status).toBe(400);
    expect((await POST(`thesis-works/${workId}/extensions`, { days: 30, reason: REASON }, 'maria')).status).toBe(403);
  });

  it('X3 – la estudiante solicita 30 días; no puede tener dos en trámite', async () => {
    const res = await POST(`thesis-works/${workId}/extensions`, { days: 30, reason: REASON }, 'ana');
    expect(res.status).toBe(201);
    expect(res.body.items[0].status).toBe('PENDING_ADVISOR');
    expect(res.body.canRequest).toBe(false);
    extId = res.body.items[0].id;
    const again = await POST(`thesis-works/${workId}/extensions`, { days: 10, reason: REASON }, 'ana');
    expect(again.status).toBe(400);
  });

  it('X4 – Coordinación no puede saltarse el aval antes del escalamiento', async () => {
    const res = await PATCH(`extensions/${extId}/approve`, {}, 'coord');
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/aval del asesor/);
  });

  it('X5 – el asesor debe explicar si no avala', async () => {
    expect((await PATCH(`extensions/${extId}/advisor-reject`, {}, 'advisor')).status).toBe(400);
    expect((await PATCH(`extensions/${extId}/endorse`, {}, 'tmp')).status).toBe(403); // no es su tesis
  });

  it('X6 – el asesor avala y pasa a Coordinación (aparece en su bandeja)', async () => {
    const res = await PATCH(`extensions/${extId}/endorse`, { note: 'Justificación válida' }, 'advisor');
    expect(res.status).toBe(200);
    expect(res.body.items[0].status).toBe('PENDING_COORDINATOR');
    const inbox = (await GET('extensions/pending', 'coord')).body;
    expect(inbox.some((e: any) => e.id === extId)).toBe(true);
  });

  it('X7 – Coordinación aprueba 20 días: se corren solo los hitos pendientes y se avisa a Registro', async () => {
    const before = (await GET(`thesis-works/${workId}/milestones`, 'coord')).body.milestones;
    const res = await PATCH(`extensions/${extId}/approve`, { approvedDays: 20, note: 'Se conceden 20 días' }, 'coord');
    expect(res.status).toBe(200);
    expect(res.body.items[0]).toMatchObject({ status: 'APPROVED', approvedDays: 20 });
    expect(res.body.approvedDays).toBe(20);

    const after = (await GET(`thesis-works/${workId}/milestones`, 'coord')).body;
    expect(after.extensionDays).toBe(20);
    for (const m of before) {
      const a = after.milestones.find((x: any) => x.id === m.id);
      const diff = (new Date(a.dueDate).getTime() - new Date(m.dueDate).getTime()) / DAY;
      expect(diff).toBe(m.state === 'DONE' ? 0 : 20);
    }
    const registro = await prisma.notification.count({
      where: { createdAt: { gte: T0 }, type: 'EXTENSION_APPROVED', user: { role: UserRole.REGISTRO } },
    });
    expect(registro).toBeGreaterThan(0);
  });

  it('X8 – la estudiante puede cancelar una solicitud en trámite (una vez)', async () => {
    const res = await POST(`thesis-works/${workId}/extensions`, { days: 15, reason: REASON }, 'ana');
    const id = res.body.items[0].id;
    expect((await PATCH(`extensions/${id}/cancel`, {}, 'ana')).body.items[0].status).toBe('CANCELLED');
    expect((await PATCH(`extensions/${id}/cancel`, {}, 'ana')).status).toBe(400);
  });

  it(`X9 – escalamiento: sin aval en ${EXTENSION_RULES.escalationDays} días, Coordinación decide y se avisa`, async () => {
    const res = await POST(`thesis-works/${workId}/extensions`, { days: 45, reason: REASON }, 'ana');
    const id = res.body.items[0].id;
    await prisma.extensionRequest.update({
      where: { id },
      data: { createdAt: new Date(Date.now() - (EXTENSION_RULES.escalationDays + 1) * DAY) },
    });
    const list = (await GET(`thesis-works/${workId}/extensions`, 'coord')).body;
    expect(list.items.find((e: any) => e.id === id)).toMatchObject({ escalated: true, can: { coordinatorDecide: true } });

    const sent = await app.get(ExtensionsService).runEscalation();
    expect(sent).toBeGreaterThan(0);
    expect(await app.get(ExtensionsService).runEscalation()).toBe(0); // no repite el aviso

    expect((await PATCH(`extensions/${id}/reject`, {}, 'coord')).status).toBe(400); // rechazo sin motivo
    const rej = await PATCH(`extensions/${id}/reject`, { note: 'Ya se concedió una prórroga este período' }, 'coord');
    expect(rej.body.items.find((e: any) => e.id === id).status).toBe('REJECTED');
  });
});

describe('Cambio de asesor', () => {
  it('Y1 – validaciones: rol, mismo asesor, motivo, y "asignar" ya no sirve para cambiar', async () => {
    expect((await PATCH(`thesis-works/${workId}/change-advisor`, { advisorId: tmpAdvisorId, reason: 'Año sabático del asesor' }, 'ana')).status).toBe(403);
    expect((await PATCH(`thesis-works/${workId}/change-advisor`, { advisorId: garciaAdvisorId, reason: 'Año sabático del asesor' }, 'coord')).status).toBe(400);
    expect((await PATCH(`thesis-works/${workId}/change-advisor`, { advisorId: tmpAdvisorId, reason: 'corto' }, 'coord')).status).toBe(400);
    const assign = await PATCH(`thesis-works/${workId}/assign-advisor`, { advisorId: tmpAdvisorId }, 'coord');
    expect(assign.status).toBe(400);
    expect(assign.body.message).toMatch(/Cambiar asesor/);
  });

  it('Y2 – Coordinación cambia el asesor; queda en el historial y el estado no cambia', async () => {
    const res = await PATCH(`thesis-works/${workId}/change-advisor`, { advisorId: tmpAdvisorId, reason: 'Año sabático del Dr. García' }, 'coord');
    expect(res.status).toBe(200);
    const last = res.body[res.body.length - 1];
    expect(last).toMatchObject({ reason: 'Año sabático del Dr. García', fromAdvisorId: garciaAdvisorId, toAdvisorId: tmpAdvisorId });
    expect(last.toAdvisor.user.lastName).toBe('Temporal');
    const work = await prisma.thesisWork.findUniqueOrThrow({ where: { id: workId } });
    expect(work.status).toBe(ThesisStatus.IN_DEVELOPMENT);
  });

  it('Y3 – el nuevo asesor hereda el historial; el anterior pierde el acceso', async () => {
    const ext = await GET(`thesis-works/${workId}/extensions`, 'tmp');
    expect(ext.status).toBe(200);
    expect(ext.body.items.length).toBeGreaterThanOrEqual(3); // ve las prórrogas previas
    expect((await GET(`thesis-works/${workId}/feedback`, 'tmp')).status).toBe(200);
    expect((await GET(`thesis-works/${workId}/advances`, 'tmp')).status).toBe(200);
    expect((await GET(`thesis-works/${workId}/feedback`, 'advisor')).status).toBe(403);
  });

  it('Y4 – avisos: estudiante, asesor nuevo y anterior', async () => {
    const notes = await prisma.notification.findMany({ where: { createdAt: { gte: T0 }, type: 'ADVISOR_CHANGED' }, select: { userId: true, message: true } });
    const garciaUserId = (await prisma.user.findUniqueOrThrow({ where: { email: 'dr.garcia@unphu.edu.do' } })).id;
    expect(notes.map((n) => n.userId)).toEqual(expect.arrayContaining([anaUserId, tmpUserId, garciaUserId]));
    expect(notes.find((n) => n.userId === tmpUserId)!.message).toMatch(/Tienes todo su historial/);
  });

  it('Y5 – las nuevas solicitudes de prórroga van al nuevo asesor', async () => {
    const res = await POST(`thesis-works/${workId}/extensions`, { days: 10, reason: REASON }, 'ana');
    const id = res.body.items[0].id;
    expect((await GET('extensions/pending', 'tmp')).body.some((e: any) => e.id === id)).toBe(true);
    expect((await GET('extensions/pending', 'advisor')).body.some((e: any) => e.id === id)).toBe(false);
  });

  it('Y6 – los correos se simulan', () => {
    expect(emailSpy).toHaveBeenCalled();
  });
});
