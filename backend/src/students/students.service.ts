import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { IsString, IsInt, IsUUID, IsOptional, IsNumber, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';

export class CreateStudentProfileDto {
  @ApiProperty() @IsString() matricula: string;
  @ApiProperty() @IsUUID() careerId: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() enrollmentYear?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) creditsApproved?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(4) gpa?: number;
}

export class UpdateStudentProfileDto {
  @ApiPropertyOptional() @IsOptional() @IsString() matricula?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() careerId?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) creditsApproved?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(4) gpa?: number;
}

@Injectable()
export class StudentsService {
  constructor(private readonly prisma: PrismaService) {}

  async createProfile(userId: string, dto: CreateStudentProfileDto) {
    const existing = await this.prisma.student.findUnique({ where: { userId } });
    if (existing) {
      // Si ya existe, hacer upsert con los datos nuevos
      return this.updateMyProfile(userId, dto);
    }

    const existingMatricula = await this.prisma.student.findUnique({ where: { matricula: dto.matricula } });
    if (existingMatricula) throw new ConflictException('La matrícula ya está registrada');

    const enrollmentYear = dto.enrollmentYear ?? new Date().getFullYear();

    return this.prisma.student.create({
      data: {
        userId,
        matricula: dto.matricula,
        careerId: dto.careerId,
        enrollmentYear,
        creditsApproved: dto.creditsApproved || 0,
        gpa: dto.gpa,
      },
      include: {
        user: { select: { firstName: true, lastName: true, email: true, phone: true } },
        career: true,
        thesisWorks: { select: { id: true, title: true, status: true } },
      },
    });
  }

  async updateMyProfile(userId: string, dto: UpdateStudentProfileDto) {
    const student = await this.prisma.student.findUnique({ where: { userId } });
    if (!student) throw new NotFoundException('Perfil de estudiante no encontrado');

    if (dto.matricula && dto.matricula !== student.matricula) {
      const dup = await this.prisma.student.findUnique({ where: { matricula: dto.matricula } });
      if (dup) throw new ConflictException('La matrícula ya está registrada');
    }

    return this.prisma.student.update({
      where: { userId },
      data: {
        ...(dto.matricula && { matricula: dto.matricula }),
        ...(dto.careerId && { careerId: dto.careerId }),
        ...(dto.creditsApproved !== undefined && { creditsApproved: dto.creditsApproved }),
        ...(dto.gpa !== undefined && { gpa: dto.gpa }),
      },
      include: {
        user: { select: { firstName: true, lastName: true, email: true, phone: true } },
        career: true,
        thesisWorks: { select: { id: true, title: true, status: true } },
      },
    });
  }

  async findAll(careerId?: string, search?: string) {
    const where: any = {};
    if (careerId) where.careerId = careerId;
    if (search) {
      where.OR = [
        { matricula: { contains: search, mode: 'insensitive' } },
        { user: { firstName: { contains: search, mode: 'insensitive' } } },
        { user: { lastName: { contains: search, mode: 'insensitive' } } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
      ];
    }

    return this.prisma.student.findMany({
      where,
      include: {
        user: { select: { firstName: true, lastName: true, email: true, phone: true, lastLogin: true } },
        career: true,
        _count: { select: { thesisWorks: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const student = await this.prisma.student.findUnique({
      where: { id },
      include: {
        user: { select: { firstName: true, lastName: true, email: true, phone: true } },
        career: true,
        thesisWorks: {
          include: { statusHistory: { orderBy: { createdAt: 'asc' }, take: 1 } },
          orderBy: { updatedAt: 'desc' },
        },
      },
    });
    if (!student) throw new NotFoundException('Estudiante no encontrado');
    return student;
  }

  async findByUserId(userId: string) {
    return this.prisma.student.findUnique({
      where: { userId },
      include: {
        career: true,
        thesisWorks: {
          include: {
            career: true,
            payment: true,
            advances: { orderBy: { version: 'desc' }, take: 3 },
            documents: { orderBy: { createdAt: 'desc' } },
            advisor: { include: { user: { select: { firstName: true, lastName: true, email: true } } } },
            statusHistory: { orderBy: { createdAt: 'asc' } },
            presentation: { include: { grades: { orderBy: { createdAt: 'asc' } } } },
            grades: true,
            _count: { select: { advances: true } },
          },
          orderBy: { updatedAt: 'desc' },
        },
      },
    });
  }

  async validateEligibility(id: string, isEligible: boolean) {
    return this.prisma.student.update({
      where: { id },
      data: { isEligible },
    });
  }
}
