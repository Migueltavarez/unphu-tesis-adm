// ════════════════════════════════════════════════════════════════════════════
// Retroalimentación tipo checklist: una ronda completa de revisión.
//
// Usa el trabajo semilla de Ana Martínez (asesor: Dr. García), lo pone
// temporalmente en desarrollo y lo restaura al terminar. El envío de correo
// está simulado: la prueba nunca manda correos reales.
// ════════════════════════════════════════════════════════════════════════════
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import * as request from 'supertest';
import { ThesisStatus } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { NotificationsService } from '../src/notifications/notifications.service';

let app: INestApplication;
let prisma: PrismaService;
const emailSpy = jest.spyOn(NotificationsService.prototype, 'sendEmail').mockResolvedValue(undefined);

const T0 = new Date();
let workId: string;
let originalStatus: ThesisStatus;
let anaUserId: string;
let advisorUserId: string;
const tokens: Record<string, string> = {};
let advance1: string;
let advance2: string;

const api = () => request(app.getHttpServer());
const auth = (r: request.Test, who: string) => r.set('Authorization', `Bearer ${tokens[who]}`);
const GET = (p: string, who: string) => auth(api().get(`/api/v1/${p}`), who);
const POST = (p: string, body: any, who: string) => auth(api().post(`/api/v1/${p}`).send(body), who);
const PATCH = (p: string, body: any, who: string) => auth(api().patch(`/api/v1/${p}`).send(body), who);
const DELETE = (p: string, who: string) => auth(api().delete(`/api/v1/${p}`), who);
const submitAdvance = (title: string) =>
  auth(api().post(`/api/v1/thesis-works/${workId}/advances`), 'ana')
    .field('title', title)
    .field('description', 'Descripción del avance con el detalle suficiente para revisarlo.');
const feedback = async (who = 'ana') => (await GET(`thesis-works/${workId}/feedback`, who)).body;

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

  const login = async (who: string, email: string, password: string) => {
    const res = await api().post('/api/v1/auth/login').send({ email, password });
    tokens[who] = res.body.accessToken;
  };
  await login('ana', 'ana.martinez@estudiante.unphu.edu.do', 'Estudiante@2024');
  await login('maria', 'maria.perez@estudiante.unphu.edu.do', 'Estudiante@2024');
  await login('advisor', 'dr.garcia@unphu.edu.do', 'Asesor@UNPHU2024');
  await login('registro', 'registro@unphu.edu.do', 'Registro@UNPHU2024');

  const ana = await prisma.user.findUniqueOrThrow({ where: { email: 'ana.martinez@estudiante.unphu.edu.do' }, include: { student: true } });
  anaUserId = ana.id;
  advisorUserId = (await prisma.user.findUniqueOrThrow({ where: { email: 'dr.garcia@unphu.edu.do' } })).id;
  const work = await prisma.thesisWork.findFirstOrThrow({ where: { studentId: ana.student!.id }, orderBy: { updatedAt: 'desc' } });
  workId = work.id;
  originalStatus = work.status;
  await prisma.thesisWork.update({ where: { id: workId }, data: { status: ThesisStatus.IN_DEVELOPMENT } });
}, 60000);

afterAll(async () => {
  try {
    const created = await prisma.advance.findMany({ where: { thesisWorkId: workId, createdAt: { gte: T0 } }, select: { id: true } });
    const ids = created.map((a) => a.id);
    await prisma.feedbackItem.deleteMany({ where: { thesisWorkId: workId, createdAt: { gte: T0 } } });
    await prisma.advanceComment.deleteMany({ where: { advanceId: { in: ids } } });
    await prisma.advance.deleteMany({ where: { id: { in: ids } } });
    await prisma.statusHistory.deleteMany({ where: { thesisWorkId: workId, createdAt: { gte: T0 } } });
    await prisma.notification.deleteMany({ where: { userId: { in: [anaUserId, advisorUserId] }, createdAt: { gte: T0 } } });
    await prisma.auditLog.deleteMany({ where: { entity: 'FeedbackItem', createdAt: { gte: T0 } } });
    await prisma.thesisWork.update({ where: { id: workId }, data: { status: originalStatus } });
  } finally {
    emailSpy.mockRestore();
    await app.close();
  }
}, 30000);

describe('Retroalimentación tipo checklist – ronda completa', () => {
  it('F1 – la estudiante envía el avance v1', async () => {
    const res = await submitAdvance('Capítulo 1 – Introducción');
    expect(res.status).toBe(201);
    advance1 = res.body.id;
  });

  it('F2 – pedir cambios sin decir qué corregir → 400', async () => {
    const res = await PATCH(`thesis-works/${workId}/advances/${advance1}/review`, { status: 'NEEDS_REVISION' }, 'advisor');
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/al menos una observación/);
  });

  it('F3 – una "revisión" con un estado que no es aprobar/pedir cambios → 400', async () => {
    const res = await PATCH(`thesis-works/${workId}/advances/${advance1}/review`, { status: 'SUBMITTED', comment: 'x' }, 'advisor');
    expect(res.status).toBe(400);
  });

  it('F4 – el asesor pide cambios con 3 observaciones y un comentario privado', async () => {
    const res = await PATCH(`thesis-works/${workId}/advances/${advance1}/review`, {
      status: 'NEEDS_REVISION',
      comment: 'Nota para el jurado: el tema es sólido, falta rigor.',
      commentPrivate: true,
      items: [
        { category: 'METHODOLOGY', severity: 'BLOCKING', text: 'Falta definir la población y la muestra', location: 'Cap. 1, 1.4' },
        { category: 'REFERENCES', severity: 'MAJOR', text: 'Las citas no siguen APA 7' },
        { category: 'WRITING', severity: 'MINOR', text: 'Revisar ortografía del resumen' },
      ],
    }, 'advisor');
    expect(res.status).toBe(200);
    const work = await prisma.thesisWork.findUniqueOrThrow({ where: { id: workId } });
    expect(work.status).toBe(ThesisStatus.ADVISOR_FEEDBACK);
  });

  it('F5 – no se puede revisar dos veces la misma versión', async () => {
    const res = await PATCH(`thesis-works/${workId}/advances/${advance1}/review`, { status: 'APPROVED' }, 'advisor');
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/ya fue revisado/);
  });

  it('F6 – la estudiante ve su checklist y puede resolver, no verificar', async () => {
    const fb = await feedback();
    expect(fb.summary).toEqual({ total: 3, open: 3, resolved: 0, verified: 0, blockingOpen: 1 });
    expect(fb.items[0].severity).toBe('BLOCKING'); // lo más grave arriba
    expect(fb.items[0].advance.version).toBeGreaterThan(0);
    expect(fb.items.every((i: any) => i.canResolve && !i.canVerify && !i.canDelete)).toBe(true);
  });

  it('F7 – el comentario privado nunca llega a la estudiante', async () => {
    const asStudent = (await GET(`thesis-works/${workId}/advances/${advance1}`, 'ana')).body;
    const asAdvisor = (await GET(`thesis-works/${workId}/advances/${advance1}`, 'advisor')).body;
    expect(asAdvisor.comments.some((c: any) => c.isPrivate)).toBe(true);
    expect(asStudent.comments.some((c: any) => c.isPrivate)).toBe(false);
    const work = (await GET(`thesis-works/${workId}`, 'ana')).body;
    const all = work.advances.flatMap((a: any) => a.comments);
    expect(all.some((c: any) => c.isPrivate)).toBe(false);
  });

  it('F8 – la estudiante no puede escribir en el hilo privado', async () => {
    const res = await POST(`thesis-works/${workId}/advances/${advance1}/comments`, { content: 'Hola', isPrivate: true }, 'ana');
    expect(res.status).toBe(201);
    expect(res.body.isPrivate).toBe(false);
  });

  it('F9 – otras personas no ven ni tocan la retroalimentación', async () => {
    expect((await GET(`thesis-works/${workId}/feedback`, 'maria')).status).toBe(403);
    expect((await GET(`thesis-works/${workId}/feedback`, 'registro')).status).toBe(403);
    const item = (await feedback()).items[0];
    expect((await PATCH(`feedback/${item.id}/resolve`, {}, 'maria')).status).toBe(403);
    expect((await PATCH(`feedback/${item.id}/verify`, {}, 'ana')).status).toBe(403);
  });

  it('F10 – no se aprueba la v2 mientras haya una bloqueante abierta', async () => {
    const res = await submitAdvance('Capítulo 1 – Introducción (corregido)');
    expect(res.status).toBe(201);
    advance2 = res.body.id;
    const review = await PATCH(`thesis-works/${workId}/advances/${advance2}/review`, { status: 'APPROVED' }, 'advisor');
    expect(review.status).toBe(400);
    expect(review.body.message).toMatch(/1 observación bloqueante sin resolver/);
  });

  it('F11 – la estudiante marca la bloqueante como resuelta (una sola vez)', async () => {
    const blocking = (await feedback()).items.find((i: any) => i.severity === 'BLOCKING');
    const res = await PATCH(`feedback/${blocking.id}/resolve`, { note: 'Agregué la sección 1.4 con población y muestra' }, 'ana');
    expect(res.status).toBe(200);
    const again = await PATCH(`feedback/${blocking.id}/resolve`, {}, 'ana');
    expect(again.status).toBe(400);
    const after = (await feedback()).items.find((i: any) => i.id === blocking.id);
    expect(after.status).toBe('RESOLVED');
    expect(after.studentNote).toMatch(/población/);
  });

  it('F12 – al aprobar la v2, lo resuelto queda verificado y lo demás sigue abierto', async () => {
    const res = await PATCH(`thesis-works/${workId}/advances/${advance2}/review`, { status: 'APPROVED' }, 'advisor');
    expect(res.status).toBe(200);
    const fb = await feedback('advisor');
    expect(fb.summary).toMatchObject({ open: 2, resolved: 0, verified: 1, blockingOpen: 0 });
  });

  it('F13 – el asesor reabre una verificada con motivo y la estudiante recibe aviso', async () => {
    const verified = (await feedback('advisor')).items.find((i: any) => i.status === 'VERIFIED');
    const res = await PATCH(`feedback/${verified.id}/reopen`, { note: 'La muestra no es representativa' }, 'advisor');
    expect(res.status).toBe(200);
    const item = res.body.items.find((i: any) => i.id === verified.id);
    expect(item).toMatchObject({ status: 'OPEN', reopenCount: 1, advisorNote: 'La muestra no es representativa' });
    const notes = await prisma.notification.findMany({ where: { userId: anaUserId, createdAt: { gte: T0 } } });
    expect(notes.map((n) => n.type)).toEqual(
      expect.arrayContaining(['ADVANCE_CHANGES_REQUESTED', 'ADVANCE_APPROVED', 'FEEDBACK_REOPENED']),
    );
  });

  it('F14 – solo se eliminan observaciones nunca atendidas', async () => {
    const items = (await feedback('advisor')).items;
    const reopened = items.find((i: any) => i.reopenCount > 0);
    const untouched = items.find((i: any) => i.severity === 'MINOR');
    expect((await DELETE(`feedback/${reopened.id}`, 'advisor')).status).toBe(400);
    expect((await DELETE(`feedback/${untouched.id}`, 'ana')).status).toBe(403);
    expect((await DELETE(`feedback/${untouched.id}`, 'advisor')).status).toBe(200);
    expect((await feedback('advisor')).summary.total).toBe(2);
  });

  it('F15 – los correos se simulan (nunca se envían de verdad en la prueba)', () => {
    expect(emailSpy).toHaveBeenCalled();
  });
});
