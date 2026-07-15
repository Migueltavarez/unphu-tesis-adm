import { Injectable, NotFoundException } from '@nestjs/common';
import { IsString, IsOptional, IsArray, IsDateString } from 'class-validator';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';

export class CreateMeetingDto {
  @IsDateString() scheduledAt: string;
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsString() virtualLink?: string;
  @IsOptional() @IsString() agenda?: string;
  @IsOptional() @IsArray() attendees?: string[];
}

@Injectable()
export class MeetingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(thesisWorkId: string, dto: CreateMeetingDto) {
    const thesisWork = await this.prisma.thesisWork.findUnique({
      where: { id: thesisWorkId },
      include: {
        student: { include: { user: { select: { id: true, firstName: true, email: true } } } },
        advisor: { include: { user: { select: { firstName: true, lastName: true } } } },
      },
    });
    if (!thesisWork) throw new NotFoundException('Trabajo de grado no encontrado');

    const meeting = await this.prisma.meeting.create({
      data: {
        thesisWorkId,
        scheduledAt: new Date(dto.scheduledAt),
        location: dto.location,
        virtualLink: dto.virtualLink,
        agenda: dto.agenda,
        attendees: dto.attendees ?? [],
      },
    });

    this.eventEmitter.emit('meeting.scheduled', { meeting, thesisWork });
    return meeting;
  }

  async list(thesisWorkId: string) {
    return this.prisma.meeting.findMany({
      where: { thesisWorkId },
      orderBy: { scheduledAt: 'asc' },
    });
  }

  async complete(id: string, notes?: string) {
    const meeting = await this.prisma.meeting.findUnique({ where: { id } });
    if (!meeting) throw new NotFoundException('Reunión no encontrada');
    return this.prisma.meeting.update({
      where: { id },
      data: { completed: true, notes: notes || undefined },
    });
  }

  async cancel(id: string) {
    const meeting = await this.prisma.meeting.findUnique({ where: { id } });
    if (!meeting) throw new NotFoundException('Reunión no encontrada');
    return this.prisma.meeting.delete({ where: { id } });
  }
}
