import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { AuditAction, ThesisStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CLOSED_STATUSES } from '../risk/risk.rules';
import { DEFAULT_PLAN, evaluateMilestones, flowIndex } from './milestone-plan';
import { UpdateMilestonePlanDto } from './milestones.dto';

const DAY_MS = 86_400_000;
const STAFF_ROLES: UserRole[] = [
  UserRole.ADMIN, UserRole.COORDINATOR, UserRole.DIRECTOR,
  UserRole.REGISTRO, UserRole.COBROS, UserRole.CAJA, UserRole.JURADO,
];

@Injectable()
export class MilestonesService implements OnApplicationBootstrap {
  private readonly logger = new Logger(MilestonesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ── Arranque: garantiza planes y genera hitos de trabajos previos ───────
  // Idempotente: solo crea lo que falta.
  async onApplicationBootstrap() {
    if (process.env.NODE_ENV === 'test') return;
    try {
      const works = await this.prisma.thesisWork.findMany({
        where: { status: { notIn: CLOSED_STATUSES }, milestones: { none: {} } },
        select: { id: true },
      });
      for (const w of works) await this.ensureForWork(w.id);
      if (works.length) this.logger.log(`Hitos generados para ${works.length} trabajo(s) existentes`);
    } catch (err) {
      this.logger.error('No se pudieron generar los hitos de trabajos existentes', err as any);
    }
  }

  // ── Plan por programa ────────────────────────────────────────────────────

  /** Plantilla de la carrera; si aún no tiene, se crea la de por defecto. */
  async getTemplates(careerId: string) {
    const existing = await this.prisma.milestoneTemplate.findMany({
      where: { careerId },
      orderBy: { order: 'asc' },
    });
    if (existing.length) return existing;

    await this.prisma.milestoneTemplate.createMany({
      data: DEFAULT_PLAN.map((p, i) => ({
        careerId,
        name: p.name,
        description: p.description,
        order: i,
        daysFromStart: p.daysFromStart,
        required: p.required ?? true,
        completesAtStatus: p.completesAtStatus ?? null,
      })),
    });
    return this.prisma.milestoneTemplate.findMany({ where: { careerId }, orderBy: { order: 'asc' } });
  }

  async getPlan(careerId: string) {
    const career = await this.prisma.career.findUnique({
      where: { id: careerId },
      select: { id: true, name: true, code: true, expectedMonths: true, maxMonths: true },
    });
    if (!career) throw new NotFoundException('Carrera no encontrada');
    const [milestones, activeWorks] = await Promise.all([
      this.getTemplates(careerId),
      this.prisma.thesisWork.count({ where: { careerId, status: { notIn: CLOSED_STATUSES } } }),
    ]);
    return { career, milestones, activeWorks };
  }

  async updatePlan(careerId: string, dto: UpdateMilestonePlanDto, userId: string) {
    const before = await this.getPlan(careerId);

    if (dto.maxMonths < dto.expectedMonths) {
      throw new BadRequestException('La duración máxima no puede ser menor que la esperada');
    }
    if (dto.milestones.length === 0) {
      throw new BadRequestException('El plan debe tener al menos un hito');
    }
    for (let i = 1; i < dto.milestones.length; i++) {
      if (dto.milestones[i].daysFromStart < dto.milestones[i - 1].daysFromStart) {
        throw new BadRequestException(
          `Los hitos deben ir en orden cronológico: "${dto.milestones[i].name}" vence antes que "${dto.milestones[i - 1].name}"`,
        );
      }
    }
    const linked = dto.milestones.filter((m) => m.completesAtStatus).map((m) => flowIndex(m.completesAtStatus!));
    if (linked.some((v, i) => i > 0 && v <= linked[i - 1])) {
      throw new BadRequestException('Las etapas ligadas a los hitos deben seguir el orden del proceso, sin repetirse');
    }

    const keepIds = new Set(dto.milestones.filter((m) => m.id).map((m) => m.id!));
    const ownIds = new Set(before.milestones.map((m) => m.id));
    if ([...keepIds].some((id) => !ownIds.has(id))) {
      throw new BadRequestException('Un hito del plan no pertenece a esta carrera');
    }

    await this.prisma.$transaction([
      this.prisma.career.update({
        where: { id: careerId },
        data: { expectedMonths: dto.expectedMonths, maxMonths: dto.maxMonths },
      }),
      this.prisma.milestoneTemplate.deleteMany({ where: { careerId, id: { notIn: [...keepIds] } } }),
      ...dto.milestones.map((m, order) => {
        const data = {
          name: m.name.trim(),
          description: m.description?.trim() || null,
          order,
          daysFromStart: m.daysFromStart,
          required: m.required ?? true,
          completesAtStatus: m.completesAtStatus ?? null,
        };
        return m.id
          ? this.prisma.milestoneTemplate.update({ where: { id: m.id }, data })
          : this.prisma.milestoneTemplate.create({ data: { ...data, careerId } });
      }),
    ]);

    const after = await this.getPlan(careerId);
    await this.audit.log(userId, AuditAction.UPDATE, 'MilestonePlan', careerId,
      { expectedMonths: before.career.expectedMonths, maxMonths: before.career.maxMonths, milestones: before.milestones.map((m) => m.name) },
      { expectedMonths: after.career.expectedMonths, maxMonths: after.career.maxMonths, milestones: after.milestones.map((m) => m.name) },
    );
    return after;
  }

  // ── Hitos de cada trabajo ────────────────────────────────────────────────

  /** Copia el plan de la carrera como hitos del trabajo (si aún no tiene). */
  async ensureForWork(thesisWorkId: string) {
    const work = await this.prisma.thesisWork.findUnique({
      where: { id: thesisWorkId },
      select: { id: true, careerId: true, createdAt: true, _count: { select: { milestones: true } } },
    });
    if (!work || work._count.milestones > 0) return;

    const templates = await this.getTemplates(work.careerId);
    await this.prisma.milestone.createMany({
      data: templates.map((t) => ({
        thesisWorkId: work.id,
        templateId: t.id,
        name: t.name,
        description: t.description,
        order: t.order,
        dueDate: new Date(work.createdAt.getTime() + t.daysFromStart * DAY_MS),
        required: t.required,
        completesAtStatus: t.completesAtStatus,
      })),
    });
  }

  async listForWork(thesisWorkId: string, userId: string, role: UserRole) {
    const work = await this.loadWorkWithAccess(thesisWorkId, userId, role);
    await this.ensureForWork(work.id);

    const [milestones, history] = await Promise.all([
      this.prisma.milestone.findMany({ where: { thesisWorkId }, orderBy: { order: 'asc' } }),
      this.prisma.statusHistory.findMany({
        where: { thesisWorkId },
        select: { toStatus: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    const canMark = this.canMarkManual(work, userId, role);
    const evaluated = evaluateMilestones(milestones, work.status);

    const items = evaluated.map(({ milestone: m, state, implicit, daysToDue }) => {
      // Fecha de cumplimiento: manual → la registrada; ligada a etapa → la
      // primera vez que el historial alcanzó esa etapa (si consta).
      let completedAt: Date | null = m.completedAt;
      if (m.completesAtStatus && state === 'DONE') {
        const target = flowIndex(m.completesAtStatus);
        completedAt = history.find((h) => flowIndex(h.toStatus) >= target)?.createdAt ?? null;
      }
      return {
        id: m.id,
        name: m.name,
        description: m.description,
        order: m.order,
        dueDate: m.dueDate,
        required: m.required,
        completesAtStatus: m.completesAtStatus,
        auto: !!m.completesAtStatus,
        state,
        implicit,
        daysToDue,
        completedAt,
        canComplete: canMark && !m.completesAtStatus && state !== 'DONE',
        canReopen: canMark && !m.completesAtStatus && !!m.completedAt,
      };
    });

    const done = items.filter((i) => i.state === 'DONE').length;
    const next = items.find((i) => i.state !== 'DONE') ?? null;
    return { startDate: work.createdAt, total: items.length, done, next, milestones: items };
  }

  async setManualCompletion(milestoneId: string, completed: boolean, userId: string, role: UserRole) {
    const milestone = await this.prisma.milestone.findUnique({ where: { id: milestoneId } });
    if (!milestone) throw new NotFoundException('Hito no encontrado');
    const work = await this.loadWorkWithAccess(milestone.thesisWorkId, userId, role);

    if (!this.canMarkManual(work, userId, role)) {
      throw new ForbiddenException('Solo el asesor del trabajo o Coordinación pueden marcar hitos');
    }
    if (milestone.completesAtStatus) {
      throw new BadRequestException('Este hito se cumple automáticamente al alcanzar su etapa del proceso');
    }

    const updated = await this.prisma.milestone.update({
      where: { id: milestoneId },
      data: completed
        ? { completedAt: new Date(), completedById: userId }
        : { completedAt: null, completedById: null },
    });
    await this.audit.log(userId, AuditAction.UPDATE, 'Milestone', milestoneId,
      { completedAt: milestone.completedAt }, { completedAt: updated.completedAt },
    );
    return updated;
  }

  // ── Acceso ───────────────────────────────────────────────────────────────

  private async loadWorkWithAccess(thesisWorkId: string, userId: string, role: UserRole) {
    const work = await this.prisma.thesisWork.findUnique({
      where: { id: thesisWorkId },
      select: {
        id: true, status: true, createdAt: true,
        student: { select: { userId: true } },
        advisor: { select: { userId: true } },
      },
    });
    if (!work) throw new NotFoundException('Trabajo de grado no encontrado');
    if (STAFF_ROLES.includes(role)) return work;
    if (role === UserRole.STUDENT && work.student?.userId === userId) return work;
    if (role === UserRole.ADVISOR && work.advisor?.userId === userId) return work;
    throw new ForbiddenException('No tienes acceso a este trabajo');
  }

  /** Hitos manuales: los marca el asesor asignado o Coordinación/Admin. */
  private canMarkManual(work: { status: ThesisStatus; advisor: { userId: string } | null }, userId: string, role: UserRole) {
    if (CLOSED_STATUSES.includes(work.status)) return false;
    if (role === UserRole.ADMIN || role === UserRole.COORDINATOR) return true;
    return role === UserRole.ADVISOR && work.advisor?.userId === userId;
  }
}
