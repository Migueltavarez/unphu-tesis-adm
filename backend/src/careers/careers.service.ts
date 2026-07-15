import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { IsString, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';

export class CreateCareerDto {
  @ApiProperty() @IsString() name: string;
  @ApiProperty() @IsString() code: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
}

export class UpdateCareerDto {
  @ApiPropertyOptional() @IsOptional() @IsString() name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

@Injectable()
export class CareersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(onlyActive = true) {
    return this.prisma.career.findMany({
      where: onlyActive ? { isActive: true } : undefined,
      include: { _count: { select: { students: true, thesisWorks: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const career = await this.prisma.career.findUnique({
      where: { id },
      include: { _count: { select: { students: true, thesisWorks: true } } },
    });
    if (!career) throw new NotFoundException('Carrera no encontrada');
    return career;
  }

  async create(dto: CreateCareerDto) {
    const existing = await this.prisma.career.findFirst({
      where: { OR: [{ name: dto.name }, { code: dto.code }] },
    });
    if (existing) throw new ConflictException('Ya existe una carrera con ese nombre o código');
    return this.prisma.career.create({ data: dto });
  }

  async update(id: string, dto: UpdateCareerDto) {
    await this.findOne(id);
    return this.prisma.career.update({ where: { id }, data: dto });
  }
}
