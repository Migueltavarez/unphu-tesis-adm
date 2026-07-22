import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { IsString, IsOptional, IsArray, ArrayNotEmpty, IsDateString, IsNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { ThesisStatus, AuditAction } from '@prisma/client';
import { AuditService } from '../audit/audit.service';

export class SchedulePresentationDto {
  @ApiProperty() @IsDateString() scheduledAt: string;
  @ApiPropertyOptional() @IsOptional() @IsString() location?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() virtualLink?: string;
  @ApiProperty({ type: [String] }) @IsArray() @ArrayNotEmpty() @IsString({ each: true }) juryMembers: string[];
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

export class RecordGradeDto {
  // Identidad ignorada por el servidor: se deriva del usuario autenticado.
  @ApiPropertyOptional() @IsOptional() @IsString() evaluatorId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() evaluatorName?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() writtenGrade?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() oralGrade?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() finalGrade?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() observations?: string;
}

@Injectable()
export class PresentationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  /** Umbral de aprobación configurable (por defecto 70). */
  private get passThreshold(): number {
    return Number(this.config.get('GRADE_PASS_THRESHOLD', 70));
  }

  async schedule(thesisWorkId: string, dto: SchedulePresentationDto, scheduledById: string) {
    const thesisWork = await this.prisma.thesisWork.findUnique({ where: { id: thesisWorkId } });
    if (!thesisWork) throw new NotFoundException('Trabajo de grado no encontrado');

    const existing = await this.prisma.presentation.findUnique({ where: { thesisWorkId } });
    if (existing) throw new BadRequestException('Ya existe una presentación programada');

    // Atómico: presentación + estado del trabajo + historial.
    const presentation = await this.prisma.$transaction(async (tx) => {
      const p = await tx.presentation.create({
        data: {
          thesisWorkId,
          scheduledAt: new Date(dto.scheduledAt),
          location: dto.location,
          virtualLink: dto.virtualLink,
          juryMembers: dto.juryMembers,
          notes: dto.notes,
        },
      });
      await tx.thesisWork.update({
        where: { id: thesisWorkId },
        data: { status: ThesisStatus.PRESENTATION_SCHEDULED },
      });
      await tx.statusHistory.create({
        data: {
          thesisWorkId,
          fromStatus: thesisWork.status,
          toStatus: ThesisStatus.PRESENTATION_SCHEDULED,
          changedById: scheduledById,
          notes: 'Presentación programada',
        },
      });
      return p;
    });

    this.eventEmitter.emit('presentation.scheduled', { presentation });
    return presentation;
  }

  async reschedule(thesisWorkId: string, dto: SchedulePresentationDto) {
    const existing = await this.prisma.presentation.findUnique({ where: { thesisWorkId } });
    if (!existing) throw new NotFoundException('No hay presentación programada para este trabajo');

    return this.prisma.presentation.update({
      where: { thesisWorkId },
      data: {
        scheduledAt: new Date(dto.scheduledAt),
        location: dto.location ?? null,
        virtualLink: dto.virtualLink ?? null,
        juryMembers: dto.juryMembers,
        notes: dto.notes ?? null,
      },
    });
  }

  async markCompleted(thesisWorkId: string, completedById: string) {
    const [presentation, work] = await Promise.all([
      this.prisma.presentation.findUnique({ where: { thesisWorkId } }),
      this.prisma.thesisWork.findUnique({ where: { id: thesisWorkId } }),
    ]);
    if (!presentation) throw new NotFoundException('Presentación no encontrada');

    // Atómico: acta + estado del trabajo + historial.
    const updated = await this.prisma.$transaction(async (tx) => {
      const p = await tx.presentation.update({
        where: { thesisWorkId },
        data: { completed: true, completedAt: new Date() },
      });
      await tx.thesisWork.update({
        where: { id: thesisWorkId },
        data: { status: ThesisStatus.PRESENTATION_DONE },
      });
      await tx.statusHistory.create({
        data: {
          thesisWorkId,
          fromStatus: work?.status ?? ThesisStatus.PRESENTATION_SCHEDULED,
          toStatus: ThesisStatus.PRESENTATION_DONE,
          changedById: completedById,
          notes: 'Presentación realizada',
        },
      });
      return p;
    });

    return updated;
  }

  async recordGrade(thesisWorkId: string, dto: RecordGradeDto, evaluatorUserId: string) {
    const [thesisWork, evaluator] = await Promise.all([
      this.prisma.thesisWork.findUnique({
        where: { id: thesisWorkId },
        include: { presentation: true },
      }),
      this.prisma.user.findUnique({
        where: { id: evaluatorUserId },
        select: { firstName: true, lastName: true },
      }),
    ]);
    if (!thesisWork) throw new NotFoundException('Trabajo de grado no encontrado');
    if (!evaluator) throw new NotFoundException('Evaluador no encontrado');

    // La identidad del evaluador se deriva del usuario autenticado, NUNCA del body,
    // para impedir suplantación (spoofing) y la inflación del promedio con notas
    // falsas bajo identidades inventadas. Cada evaluador puede registrar una sola nota.
    const existing = await this.prisma.grade.findFirst({
      where: { thesisWorkId, evaluatorId: evaluatorUserId },
    });
    if (existing) {
      throw new ConflictException('Ya registraste una calificación para este trabajo');
    }

    // La nota final se deriva del promedio escrito/oral si no se envía explícita,
    // en vez de asumir 0 (que hundía injustamente el promedio del tribunal).
    const finalGrade = this.resolveFinalGrade(dto);
    const threshold = this.passThreshold;

    const evaluatorName = `${evaluator.firstName} ${evaluator.lastName}`.trim();
    const grade = await this.prisma.grade.create({
      data: {
        thesisWorkId,
        presentationId: thesisWork.presentation?.id,
        evaluatorId: evaluatorUserId,
        evaluatorName,
        writtenGrade: dto.writtenGrade,
        oralGrade: dto.oralGrade,
        finalGrade,
        approved: finalGrade !== undefined ? finalGrade >= threshold : null,
        observations: dto.observations,
      },
    });

    // Verificar si todo el tribunal calificó. Requiere un jurado definido
    // (juryMembers no vacío) para no auto-finalizar con un solo voto.
    if (thesisWork.presentation) {
      const juryCount = thesisWork.presentation.juryMembers.length;
      const grades = await this.prisma.grade.findMany({ where: { thesisWorkId } });
      const allGraded = juryCount > 0 && grades.length >= juryCount;

      if (allGraded) {
        // Promedio solo sobre notas finales válidas (ignora las nulas).
        const scored = grades.filter((g) => g.finalGrade != null);
        const avgFinal = scored.length
          ? scored.reduce((sum, g) => sum + (g.finalGrade as number), 0) / scored.length
          : 0;
        const approved = avgFinal >= threshold;
        const newStatus = approved ? ThesisStatus.APPROVED : ThesisStatus.REJECTED;

        await this.prisma.$transaction(async (tx) => {
          await tx.thesisWork.update({
            where: { id: thesisWorkId },
            data: { status: newStatus, approvedAt: approved ? new Date() : undefined },
          });
          await tx.statusHistory.create({
            data: {
              thesisWorkId,
              fromStatus: ThesisStatus.GRADED,
              toStatus: newStatus,
              changedById: evaluatorUserId,
              notes: `Promedio del tribunal: ${avgFinal.toFixed(2)} (umbral ${threshold})`,
            },
          });
        });
      } else {
        await this.prisma.thesisWork.update({
          where: { id: thesisWorkId },
          data: { status: ThesisStatus.GRADED },
        });
      }
    }

    await this.audit.log(evaluatorUserId, AuditAction.CREATE, 'Grade', grade.id, null, { finalGrade, thesisWorkId });
    return grade;
  }

  /** Nota final: explícita si viene en el DTO; si no, promedio de escrito y oral. */
  private resolveFinalGrade(dto: RecordGradeDto): number | undefined {
    if (dto.finalGrade !== undefined && dto.finalGrade !== null) return dto.finalGrade;
    if (dto.writtenGrade != null && dto.oralGrade != null) {
      return (dto.writtenGrade + dto.oralGrade) / 2;
    }
    if (dto.writtenGrade != null) return dto.writtenGrade;
    if (dto.oralGrade != null) return dto.oralGrade;
    return undefined;
  }

  async getGrades(thesisWorkId: string) {
    return this.prisma.grade.findMany({
      where: { thesisWorkId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findByThesis(thesisWorkId: string) {
    return this.prisma.presentation.findUnique({
      where: { thesisWorkId },
      include: { grades: true },
    });
  }
}
