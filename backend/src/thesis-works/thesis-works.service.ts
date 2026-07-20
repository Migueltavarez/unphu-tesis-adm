import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateThesisWorkDto,
  UpdateThesisWorkDto,
  UpdateStatusDto,
  AssignAdvisorDto,
  ThesisWorkQueryDto,
} from './dto/thesis-work.dto';
import { ThesisStatus, UserRole, AuditAction } from '@prisma/client';

// Transiciones válidas para PATCH /thesis-works/:id/status, siguiendo el orden
// documentado en el enum ThesisStatus (schema.prisma). Las transiciones que ya
// se validan en su propio endpoint dedicado (submit-proposal, assign-advisor,
// presentations/schedule|complete|grades, payments) también pasan por aquí como
// alternativa manual para el staff (p.ej. corregir un expediente atascado), por
// eso quedan incluidas explícitamente. ADMIN puede saltarse esta validación para
// correcciones excepcionales.
const ALLOWED_STATUS_TRANSITIONS: Partial<Record<ThesisStatus, ThesisStatus[]>> = {
  [ThesisStatus.POSTULATION]: [ThesisStatus.ACADEMIC_VALIDATION, ThesisStatus.REJECTED],
  [ThesisStatus.ACADEMIC_VALIDATION]: [ThesisStatus.PROPOSAL_FORM, ThesisStatus.REJECTED],
  [ThesisStatus.PROPOSAL_REVIEW]: [ThesisStatus.PROPOSAL_APPROVED, ThesisStatus.PROPOSAL_FORM, ThesisStatus.REJECTED],
  [ThesisStatus.PROPOSAL_APPROVED]: [ThesisStatus.REGISTRO_PROCESSING, ThesisStatus.REJECTED],
  [ThesisStatus.REGISTRO_PROCESSING]: [ThesisStatus.REGISTERED],
  [ThesisStatus.PAYMENT_CONFIRMED]: [ThesisStatus.FACULTY_MEETING, ThesisStatus.REJECTED],
  [ThesisStatus.FACULTY_MEETING]: [ThesisStatus.DRAFT_IN_PROGRESS, ThesisStatus.REJECTED],
  [ThesisStatus.DRAFT_IN_PROGRESS]: [ThesisStatus.DRAFT_UNDER_REVIEW, ThesisStatus.REJECTED],
  [ThesisStatus.DRAFT_UNDER_REVIEW]: [ThesisStatus.DRAFT_APPROVED, ThesisStatus.DRAFT_IN_PROGRESS, ThesisStatus.REJECTED],
  [ThesisStatus.DRAFT_APPROVED]: [ThesisStatus.ADVISOR_ASSIGNED],
  [ThesisStatus.ADVISOR_ASSIGNED]: [ThesisStatus.WORK_STARTED, ThesisStatus.REJECTED],
  [ThesisStatus.WORK_STARTED]: [ThesisStatus.IN_DEVELOPMENT],
  [ThesisStatus.IN_DEVELOPMENT]: [ThesisStatus.ADVANCES_SUBMITTED, ThesisStatus.WORK_COMPLETED],
  [ThesisStatus.ADVANCES_SUBMITTED]: [ThesisStatus.ADVISOR_FEEDBACK, ThesisStatus.IN_DEVELOPMENT],
  [ThesisStatus.ADVISOR_FEEDBACK]: [ThesisStatus.IN_DEVELOPMENT, ThesisStatus.WORK_COMPLETED],
  [ThesisStatus.WORK_COMPLETED]: [ThesisStatus.PRESENTATION_SCHEDULED, ThesisStatus.REJECTED],
  [ThesisStatus.PRESENTATION_SCHEDULED]: [ThesisStatus.PRESENTATION_DONE],
  [ThesisStatus.PRESENTATION_DONE]: [ThesisStatus.GRADED],
  [ThesisStatus.GRADED]: [ThesisStatus.APPROVED, ThesisStatus.REJECTED],
  [ThesisStatus.APPROVED]: [ThesisStatus.PUBLISHED],
};

const THESIS_INCLUDE = {
  student: { include: { user: { select: { firstName: true, lastName: true, email: true } }, career: true } },
  advisor: { include: { user: { select: { firstName: true, lastName: true, email: true } } } },
  career: true,
  payment: true,
  draft: true,
  presentation: true,
  grades: true,
  _count: { select: { advances: true, documents: true } },
};

@Injectable()
export class ThesisWorksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(studentId: string, dto: CreateThesisWorkDto) {
    const student = await this.prisma.student.findUnique({ where: { id: studentId } });
    if (!student) throw new NotFoundException('Estudiante no encontrado');

    if (!student.isEligible) {
      throw new ForbiddenException(
        'Tu elegibilidad académica no ha sido validada aún. Contacta con Coordinación o el Dpto. de Registro.',
      );
    }

    const active = await this.prisma.thesisWork.findFirst({
      where: { studentId, status: { notIn: [ThesisStatus.REJECTED, ThesisStatus.PUBLISHED] } },
    });
    if (active) throw new BadRequestException('Ya tienes un trabajo de grado activo');

    const thesisWork = await this.prisma.thesisWork.create({
      data: {
        studentId,
        careerId: dto.careerId,
        title: dto.title,
        type: dto.type,
        abstract: dto.abstract,
        keywords: dto.keywords || [],
        year: new Date().getFullYear(),
        status: ThesisStatus.POSTULATION,
      },
      include: THESIS_INCLUDE,
    });

    await this.createStatusHistory(thesisWork.id, null, ThesisStatus.POSTULATION, studentId, 'Postulación enviada');

    this.eventEmitter.emit('thesis.created', { thesisWork });
    return thesisWork;
  }

  async findAll(query: ThesisWorkQueryDto, userRole: UserRole, userId?: string) {
    const { status, careerId, year, search, page = 1, limit = 20 } = query;
    const skip = Math.max(0, (page - 1) * limit);

    const where: any = {};
    if (status) where.status = status;
    if (careerId) where.careerId = careerId;
    if (year) where.year = year;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { abstract: { contains: search, mode: 'insensitive' } },
        { student: { user: { firstName: { contains: search, mode: 'insensitive' } } } },
        { student: { user: { lastName: { contains: search, mode: 'insensitive' } } } },
      ];
    }

    if (userRole === UserRole.STUDENT) {
      const student = await this.prisma.student.findFirst({ where: { userId } });
      if (student) where.studentId = student.id;
    } else if (userRole === UserRole.ADVISOR) {
      const advisor = await this.prisma.advisor.findFirst({ where: { userId } });
      if (advisor) where.advisorId = advisor.id;
    }

    const [data, total] = await Promise.all([
      this.prisma.thesisWork.findMany({
        where,
        include: THESIS_INCLUDE,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.thesisWork.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string, userId: string, userRole: UserRole) {
    const thesisWork = await this.prisma.thesisWork.findUnique({
      where: { id },
      include: {
        ...THESIS_INCLUDE,
        statusHistory: { orderBy: { createdAt: 'asc' } },
        advances: {
          include: {
            comments: {
              include: { author: { select: { firstName: true, lastName: true } } },
              orderBy: { createdAt: 'asc' },
            },
          },
          orderBy: { version: 'desc' },
        },
        documents: { orderBy: { createdAt: 'desc' } },
        meetings: { orderBy: { scheduledAt: 'desc' } },
      },
    });

    if (!thesisWork) throw new NotFoundException('Trabajo de grado no encontrado');
    this.checkAccess(thesisWork, userId, userRole);
    return thesisWork;
  }

  async update(id: string, dto: UpdateThesisWorkDto, userId: string, userRole: UserRole) {
    const thesisWork = await this.findOneRaw(id);
    this.checkAccess(thesisWork, userId, userRole);

    const updated = await this.prisma.thesisWork.update({
      where: { id },
      data: dto,
      include: THESIS_INCLUDE,
    });

    return updated;
  }

  async updateStatus(id: string, dto: UpdateStatusDto, changedById: string, changedByRole: UserRole) {
    const thesisWork = await this.findOneRaw(id);
    const oldStatus = thesisWork.status;

    if (changedByRole !== UserRole.ADMIN && oldStatus !== dto.status) {
      const allowedNext = ALLOWED_STATUS_TRANSITIONS[oldStatus] ?? [];
      if (!allowedNext.includes(dto.status)) {
        throw new BadRequestException(
          `No se puede cambiar de "${oldStatus}" a "${dto.status}". Transición no permitida.`,
        );
      }
    }

    const updated = await this.prisma.thesisWork.update({
      where: { id },
      data: {
        status: dto.status,
        rejectionReason: dto.rejectionReason || null,
        approvedAt: dto.status === ThesisStatus.APPROVED ? new Date() : undefined,
        publishedAt: dto.status === ThesisStatus.PUBLISHED ? new Date() : undefined,
      },
      include: THESIS_INCLUDE,
    });

    await this.createStatusHistory(id, oldStatus, dto.status, changedById, dto.notes);
    this.eventEmitter.emit('thesis.status-changed', { thesisWork: updated, oldStatus, newStatus: dto.status });

    return updated;
  }

  async assignAdvisor(id: string, dto: AssignAdvisorDto, coordinatorId: string) {
    const [thesisWork, advisor] = await Promise.all([
      this.findOneRaw(id),
      this.prisma.advisor.findUnique({ where: { id: dto.advisorId } }),
    ]);

    if (!advisor) throw new NotFoundException('Asesor no encontrado');

    const workload = await this.prisma.thesisWork.count({
      where: { advisorId: dto.advisorId, status: { notIn: [ThesisStatus.APPROVED, ThesisStatus.PUBLISHED, ThesisStatus.REJECTED] } },
    });

    if (workload >= advisor.maxWorkload) {
      throw new BadRequestException('El asesor ha alcanzado su carga máxima de trabajos');
    }

    const updated = await this.prisma.thesisWork.update({
      where: { id },
      data: { advisorId: dto.advisorId, status: ThesisStatus.ADVISOR_ASSIGNED },
      include: THESIS_INCLUDE,
    });

    await this.createStatusHistory(id, thesisWork.status, ThesisStatus.ADVISOR_ASSIGNED, coordinatorId, `Asesor asignado`);
    this.eventEmitter.emit('thesis.advisor-assigned', { thesisWork: updated });

    return updated;
  }

  async getMetrics() {
    const [total, byStatus, byCareerRaw, byType, byYear, careers, gradeStats, nodeStats] = await Promise.all([
      this.prisma.thesisWork.count(),
      this.prisma.thesisWork.groupBy({ by: ['status'], _count: true }),
      this.prisma.thesisWork.groupBy({ by: ['careerId'], _count: true }),
      this.prisma.thesisWork.groupBy({ by: ['type'], _count: true }),
      this.prisma.thesisWork.groupBy({ by: ['year'], _count: true, orderBy: { year: 'asc' } }),
      this.prisma.career.findMany({ select: { id: true, name: true, code: true } }),
      this.prisma.grade.aggregate({ _avg: { finalGrade: true }, _min: { finalGrade: true }, _max: { finalGrade: true }, _count: { finalGrade: true } }),
      this.prisma.documentNode.groupBy({ by: ['status'], _count: true }),
    ]);

    // Enrich careers with names
    const careerMap = Object.fromEntries(careers.map((c) => [c.id, c]));
    const byCareer = byCareerRaw.map((r) => ({
      careerId: r.careerId,
      careerName: careerMap[r.careerId ?? '']?.name ?? 'Sin carrera',
      careerCode: careerMap[r.careerId ?? '']?.code ?? '',
      count: r._count,
    }));

    // Funnel stages
    const statusMap = Object.fromEntries(byStatus.map((s) => [s.status, s._count]));
    const funnel = [
      { stage: 'Postulaciones', count: total },
      { stage: 'En desarrollo', count: (statusMap['IN_DEVELOPMENT'] ?? 0) + (statusMap['WORK_STARTED'] ?? 0) + (statusMap['ADVANCES_SUBMITTED'] ?? 0) },
      { stage: 'Completados', count: statusMap['WORK_COMPLETED'] ?? 0 },
      { stage: 'Presentados', count: (statusMap['PRESENTATION_SCHEDULED'] ?? 0) + (statusMap['PRESENTATION_DONE'] ?? 0) + (statusMap['GRADED'] ?? 0) },
      { stage: 'Aprobados', count: statusMap['APPROVED'] ?? 0 },
      { stage: 'Publicados', count: statusMap['PUBLISHED'] ?? 0 },
    ];

    const approved = statusMap['APPROVED'] ?? 0;
    const rejected = statusMap['REJECTED'] ?? 0;
    const approvalRate = approved + rejected > 0 ? Math.round((approved / (approved + rejected)) * 100) : null;

    return {
      total,
      byStatus,
      byCareer,
      byType,
      byYear: byYear.map((y) => ({ year: y.year, count: y._count })),
      funnel,
      approvalRate,
      grades: {
        avg: gradeStats._avg.finalGrade ? Math.round(gradeStats._avg.finalGrade * 10) / 10 : null,
        min: gradeStats._min.finalGrade,
        max: gradeStats._max.finalGrade,
        total: gradeStats._count.finalGrade,
      },
      sections: {
        byStatus: nodeStats.map((s) => ({ status: s.status, count: s._count })),
        total: nodeStats.reduce((sum, s) => sum + s._count, 0),
        approved: nodeStats.find((s) => s.status === 'APPROVED')?._count ?? 0,
      },
    };
  }

  async getMonthlyStats() {
    const since = new Date();
    since.setMonth(since.getMonth() - 11);
    since.setDate(1);
    since.setHours(0, 0, 0, 0);

    const works = await this.prisma.thesisWork.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true },
    });

    const now = new Date();
    const months: { key: string; label: string; nuevos: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('es-DO', { month: 'short', year: '2-digit' });
      months.push({ key, label, nuevos: 0 });
    }

    for (const w of works) {
      const d = new Date(w.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const entry = months.find((m) => m.key === key);
      if (entry) entry.nuevos++;
    }

    return months.map(({ label, nuevos }) => ({ month: label, nuevos }));
  }

  private async findOneRaw(id: string) {
    const work = await this.prisma.thesisWork.findUnique({
      where: { id },
      include: {
        student: { select: { userId: true } },
        advisor:  { select: { userId: true } },
      },
    });
    if (!work) throw new NotFoundException('Trabajo de grado no encontrado');
    return work;
  }

  async submitProposal(id: string, firma: string, userId: string) {
    const work = await this.findOneRaw(id);
    const student = await this.prisma.student.findFirst({ where: { userId } });
    if (!student || work.studentId !== student.id) {
      throw new ForbiddenException('No tienes acceso a este trabajo');
    }
    if (!([ThesisStatus.POSTULATION, ThesisStatus.PROPOSAL_FORM] as ThesisStatus[]).includes(work.status)) {
      throw new BadRequestException('El trabajo no está en una etapa donde se puede enviar la propuesta');
    }

    const updated = await this.prisma.thesisWork.update({
      where: { id },
      data: { firma, status: ThesisStatus.PROPOSAL_REVIEW },
      include: THESIS_INCLUDE,
    });

    await this.createStatusHistory(id, work.status, ThesisStatus.PROPOSAL_REVIEW, userId, 'Propuesta enviada por el estudiante');
    this.eventEmitter.emit('thesis.proposal-submitted', { thesisWork: updated });
    return updated;
  }

  private checkAccess(thesisWork: any, userId: string, userRole: UserRole) {
    const staffRoles: string[] = [
      UserRole.ADMIN, UserRole.COORDINATOR, UserRole.DIRECTOR,
      UserRole.REGISTRO, UserRole.COBROS, UserRole.CAJA, UserRole.JURADO,
    ];
    if (staffRoles.includes(userRole)) return;
    if (userRole === UserRole.STUDENT && thesisWork.student?.userId !== userId) {
      throw new ForbiddenException('No tienes acceso a este trabajo');
    }
    if (userRole === UserRole.ADVISOR && thesisWork.advisor?.userId !== userId) {
      throw new ForbiddenException('No tienes acceso a este trabajo');
    }
  }

  private async createStatusHistory(
    thesisWorkId: string,
    fromStatus: ThesisStatus | null,
    toStatus: ThesisStatus,
    changedById: string,
    notes?: string,
  ) {
    await this.prisma.statusHistory.create({
      data: { thesisWorkId, fromStatus, toStatus, changedById, notes },
    });
  }
}
