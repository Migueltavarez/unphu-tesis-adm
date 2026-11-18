import { Injectable, NotFoundException } from '@nestjs/common';
import { IsArray, IsInt, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { RiskService } from '../risk/risk.service';

export class UpdateAdvisorDto {
  @ApiPropertyOptional() @IsOptional() @IsString() department?: string;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() specialties?: string[];
  @ApiPropertyOptional() @IsOptional() @IsInt() maxWorkload?: number;
}

@Injectable()
export class AdvisorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly risk: RiskService,
  ) {}

  async findAll() {
    const [advisors, active] = await Promise.all([
      this.prisma.advisor.findMany({
        include: {
          user: { select: { firstName: true, lastName: true, email: true, phone: true, isActive: true } },
          _count: { select: { thesisWorks: true } },
        },
        orderBy: { user: { lastName: 'asc' } },
      }),
      this.prisma.thesisWork.groupBy({
        by: ['advisorId'],
        where: { advisorId: { not: null }, status: { notIn: ['APPROVED', 'PUBLISHED', 'REJECTED'] } },
        _count: { _all: true },
      }),
    ]);
    const load = new Map(active.map((a) => [a.advisorId, a._count._all]));
    // activeWorks: trabajos en curso (lo que cuenta para la carga máxima).
    return advisors.map((a) => ({ ...a, activeWorks: load.get(a.id) ?? 0 }));
  }

  async findOne(id: string) {
    const advisor = await this.prisma.advisor.findUnique({
      where: { id },
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
        thesisWorks: {
          include: {
            student: { include: { user: { select: { firstName: true, lastName: true } } } },
            career: { select: { name: true } },
          },
          orderBy: { updatedAt: 'desc' },
        },
      },
    });
    if (!advisor) throw new NotFoundException('Asesor no encontrado');
    return advisor;
  }

  async findByUserId(userId: string) {
    const advisor = await this.prisma.advisor.findUnique({
      where: { userId },
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
        thesisWorks: {
          include: {
            student: { include: { user: { select: { firstName: true, lastName: true } }, career: true } },
            advances: { orderBy: { version: 'desc' }, take: 1 },
            _count: { select: { advances: true } },
          },
          orderBy: { updatedAt: 'desc' },
        },
      },
    });
    if (!advisor) throw new NotFoundException('Perfil de asesor no encontrado');
    return { ...advisor, thesisWorks: await this.risk.attach(advisor.thesisWorks) };
  }

  async update(id: string, dto: UpdateAdvisorDto) {
    await this.findOne(id);
    return this.prisma.advisor.update({ where: { id }, data: dto });
  }

  async createProfile(userId: string, dto: UpdateAdvisorDto) {
    return this.prisma.advisor.create({
      data: {
        userId,
        department: dto.department,
        specialties: dto.specialties || [],
        maxWorkload: dto.maxWorkload || 5,
      },
    });
  }
}
