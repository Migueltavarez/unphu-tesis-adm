import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Res,
  NotFoundException,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { ThesisWorksService } from './thesis-works.service';
import {
  CreateThesisWorkDto,
  UpdateThesisWorkDto,
  UpdateStatusDto,
  AssignAdvisorDto,
  ThesisWorkQueryDto,
} from './dto/thesis-work.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('thesis-works')
@ApiBearerAuth('JWT')
@Controller('thesis-works')
export class ThesisWorksController {
  constructor(
    private readonly thesisWorksService: ThesisWorksService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: 'Crear postulación de trabajo de grado' })
  async create(@CurrentUser('id') userId: string, @Body() dto: CreateThesisWorkDto) {
    const student = await this.prisma.student.findUnique({ where: { userId } });
    if (!student) throw new NotFoundException('Perfil de estudiante no encontrado. Completa tu perfil primero.');
    return this.thesisWorksService.create(student.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar trabajos (filtrado por rol)' })
  findAll(
    @Query() query: ThesisWorkQueryDto,
    @CurrentUser('role') role: UserRole,
    @CurrentUser('id') userId: string,
  ) {
    return this.thesisWorksService.findAll(query, role, userId);
  }

  @Get('metrics')
  @Roles(UserRole.ADMIN, UserRole.COORDINATOR, UserRole.DIRECTOR)
  @ApiOperation({ summary: 'Métricas del sistema' })
  getMetrics() {
    return this.thesisWorksService.getMetrics();
  }

  @Get('export')
  @Roles(UserRole.ADMIN, UserRole.COORDINATOR, UserRole.DIRECTOR)
  @ApiOperation({ summary: 'Exportar trabajos de grado como CSV' })
  async exportCsv(@Res() res: Response) {
    const works = await this.prisma.thesisWork.findMany({
      include: {
        student: { include: { user: { select: { firstName: true, lastName: true, email: true } } } },
        advisor: { include: { user: { select: { firstName: true, lastName: true } } } },
        career: { select: { name: true, code: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const escape = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header = ['Título', 'Tipo', 'Estado', 'Carrera', 'Estudiante', 'Matrícula', 'Email', 'Asesor', 'Año', 'Fecha creación'].join(',');
    const rows = works.map((w) =>
      [
        escape(w.title),
        escape(w.type),
        escape(w.status),
        escape(w.career?.name),
        escape(`${w.student?.user?.firstName ?? ''} ${w.student?.user?.lastName ?? ''}`.trim()),
        escape((w.student as any)?.matricula ?? ''),
        escape(w.student?.user?.email ?? ''),
        escape(`${w.advisor?.user?.firstName ?? ''} ${w.advisor?.user?.lastName ?? ''}`.trim()),
        escape(w.year),
        escape(w.createdAt.toISOString().slice(0, 10)),
      ].join(','),
    );

    const csv = [header, ...rows].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="trabajos-grado.csv"');
    res.send('﻿' + csv);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener trabajo de grado por ID' })
  findOne(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
  ) {
    return this.thesisWorksService.findOne(id, userId, role);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar datos del trabajo de grado' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateThesisWorkDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
  ) {
    return this.thesisWorksService.update(id, dto, userId, role);
  }

  @Patch(':id/status')
  @Roles(UserRole.ADMIN, UserRole.COORDINATOR, UserRole.ADVISOR)
  @ApiOperation({ summary: 'Cambiar estado del trabajo de grado' })
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateStatusDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.thesisWorksService.updateStatus(id, dto, userId);
  }

  @Patch(':id/assign-advisor')
  @Roles(UserRole.ADMIN, UserRole.COORDINATOR)
  @ApiOperation({ summary: 'Asignar asesor al trabajo' })
  assignAdvisor(
    @Param('id') id: string,
    @Body() dto: AssignAdvisorDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.thesisWorksService.assignAdvisor(id, dto, userId);
  }

}
