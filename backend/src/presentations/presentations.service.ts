import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { IsString, IsOptional, IsArray, IsDateString, IsNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { ThesisStatus } from '@prisma/client';

export class SchedulePresentationDto {
  @ApiProperty() @IsDateString() scheduledAt: string;
  @ApiPropertyOptional() @IsOptional() @IsString() location?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() virtualLink?: string;
  @ApiProperty({ type: [String] }) @IsArray() juryMembers: string[];
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
  ) {}

  async schedule(thesisWorkId: string, dto: SchedulePresentationDto) {
    const thesisWork = await this.prisma.thesisWork.findUnique({ where: { id: thesisWorkId } });
    if (!thesisWork) throw new NotFoundException('Trabajo de grado no encontrado');

    const existing = await this.prisma.presentation.findUnique({ where: { thesisWorkId } });
    if (existing) throw new BadRequestException('Ya existe una presentación programada');

    const presentation = await this.prisma.presentation.create({
      data: {
        thesisWorkId,
        scheduledAt: new Date(dto.scheduledAt),
        location: dto.location,
        virtualLink: dto.virtualLink,
        juryMembers: dto.juryMembers,
        notes: dto.notes,
      },
    });

    await this.prisma.thesisWork.update({
      where: { id: thesisWorkId },
      data: { status: ThesisStatus.PRESENTATION_SCHEDULED },
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

  async markCompleted(thesisWorkId: string) {
    const presentation = await this.prisma.presentation.findUnique({ where: { thesisWorkId } });
    if (!presentation) throw new NotFoundException('Presentación no encontrada');

    const updated = await this.prisma.presentation.update({
      where: { thesisWorkId },
      data: { completed: true, completedAt: new Date() },
    });

    await this.prisma.thesisWork.update({
      where: { id: thesisWorkId },
      data: { status: ThesisStatus.PRESENTATION_DONE },
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

    const evaluatorName = `${evaluator.firstName} ${evaluator.lastName}`.trim();
    const grade = await this.prisma.grade.create({
      data: {
        thesisWorkId,
        presentationId: thesisWork.presentation?.id,
        evaluatorId: evaluatorUserId,
        evaluatorName,
        writtenGrade: dto.writtenGrade,
        oralGrade: dto.oralGrade,
        finalGrade: dto.finalGrade,
        approved: dto.finalGrade !== undefined ? dto.finalGrade >= 70 : null,
        observations: dto.observations,
      },
    });

    // Verificar si todos los jurados calificaron
    if (thesisWork.presentation) {
      const grades = await this.prisma.grade.findMany({ where: { thesisWorkId } });
      const allGraded = grades.length >= thesisWork.presentation.juryMembers.length;

      if (allGraded) {
        const avgFinal = grades.reduce((sum, g) => sum + (g.finalGrade || 0), 0) / grades.length;
        const approved = avgFinal >= 70;

        await this.prisma.thesisWork.update({
          where: { id: thesisWorkId },
          data: { status: approved ? ThesisStatus.APPROVED : ThesisStatus.REJECTED },
        });
      } else {
        await this.prisma.thesisWork.update({
          where: { id: thesisWorkId },
          data: { status: ThesisStatus.GRADED },
        });
      }
    }

    return grade;
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
