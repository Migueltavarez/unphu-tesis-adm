import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { IsString, IsOptional, IsArray, IsDateString } from 'class-validator';
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
  @ApiProperty() @IsString() evaluatorId: string;
  @ApiProperty() @IsString() evaluatorName: string;
  @ApiPropertyOptional() writtenGrade?: number;
  @ApiPropertyOptional() oralGrade?: number;
  @ApiPropertyOptional() finalGrade?: number;
  @ApiPropertyOptional() @IsString() observations?: string;
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

  async recordGrade(thesisWorkId: string, dto: RecordGradeDto, coordinatorId: string) {
    const thesisWork = await this.prisma.thesisWork.findUnique({
      where: { id: thesisWorkId },
      include: { presentation: true },
    });
    if (!thesisWork) throw new NotFoundException('Trabajo de grado no encontrado');

    const grade = await this.prisma.grade.create({
      data: {
        thesisWorkId,
        presentationId: thesisWork.presentation?.id,
        evaluatorId: dto.evaluatorId,
        evaluatorName: dto.evaluatorName,
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
