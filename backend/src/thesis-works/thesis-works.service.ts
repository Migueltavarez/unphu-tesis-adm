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
        status: ThesisStatus.PENDING_PAYMENT,
      },
      include: THESIS_INCLUDE,
    });

    // Crear historial y registro de pago inicial en paralelo
    await Promise.all([
      this.createStatusHistory(thesisWork.id, null, ThesisStatus.PENDING_PAYMENT, studentId),
      this.prisma.payment.create({
        data: { thesisWorkId: thesisWork.id, amount: 3500, status: 'PENDING' },
      }),
    ]);

    this.eventEmitter.emit('thesis.created', { thesisWork });
    return thesisWork;
  }

  async findAll(query: ThesisWorkQueryDto, userRole: UserRole, userId?: string) {
    const { status, careerId, year, search, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

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

  async updateStatus(id: string, dto: UpdateStatusDto, changedById: string) {
    const thesisWork = await this.findOneRaw(id);
    const oldStatus = thesisWork.status;

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
    const [total, byStatus, byCareerRaw, byType, byYear, careers, gradeStats, sectionStats] = await Promise.all([
      this.prisma.thesisWork.count(),
      this.prisma.thesisWork.groupBy({ by: ['status'], _count: true }),
      this.prisma.thesisWork.groupBy({ by: ['careerId'], _count: true }),
      this.prisma.thesisWork.groupBy({ by: ['type'], _count: true }),
      this.prisma.thesisWork.groupBy({ by: ['year'], _count: true, orderBy: { year: 'asc' } }),
      this.prisma.career.findMany({ select: { id: true, name: true, code: true } }),
      this.prisma.grade.aggregate({ _avg: { finalGrade: true }, _min: { finalGrade: true }, _max: { finalGrade: true }, _count: { finalGrade: true } }),
      this.prisma.section.groupBy({ by: ['status'], _count: true }),
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
        byStatus: sectionStats.map((s) => ({ status: s.status, count: s._count })),
        total: sectionStats.reduce((sum, s) => sum + s._count, 0),
        approved: sectionStats.find((s) => s.status === 'APPROVED')?._count ?? 0,
      },
    };
  }

  private async findOneRaw(id: string) {
    const work = await this.prisma.thesisWork.findUnique({ where: { id } });
    if (!work) throw new NotFoundException('Trabajo de grado no encontrado');
    return work;
  }

  private checkAccess(thesisWork: any, userId: string, userRole: UserRole) {
    if (([UserRole.ADMIN, UserRole.COORDINATOR, UserRole.DIRECTOR] as string[]).includes(userRole)) return;
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
