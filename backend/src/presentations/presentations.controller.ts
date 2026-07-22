import { Controller, Get, Post, Patch, Param, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { PresentationsService, SchedulePresentationDto, RecordGradeDto } from './presentations.service';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('presentations')
@ApiBearerAuth('JWT')
@Controller('thesis-works/:thesisWorkId/presentation')
export class PresentationsController {
  constructor(private readonly service: PresentationsService) {}

  @Post('schedule')
  @Roles(UserRole.COORDINATOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Programar presentación' })
  schedule(
    @Param('thesisWorkId') id: string,
    @Body() dto: SchedulePresentationDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.service.schedule(id, dto, userId);
  }

  @Patch('reschedule')
  @Roles(UserRole.COORDINATOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Reagendar / editar presentación existente' })
  reschedule(@Param('thesisWorkId') id: string, @Body() dto: SchedulePresentationDto) {
    return this.service.reschedule(id, dto);
  }

  @Patch('complete')
  @Roles(UserRole.COORDINATOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Marcar presentación como realizada' })
  markCompleted(@Param('thesisWorkId') id: string, @CurrentUser('id') userId: string) {
    return this.service.markCompleted(id, userId);
  }

  @Post('grades')
  @Roles(UserRole.COORDINATOR, UserRole.ADMIN, UserRole.EVALUATOR, UserRole.JURADO)
  @ApiOperation({ summary: 'Registrar calificación de jurado' })
  recordGrade(
    @Param('thesisWorkId') id: string,
    @Body() dto: RecordGradeDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.service.recordGrade(id, dto, userId);
  }

  @Get('grades')
  @ApiOperation({ summary: 'Ver calificaciones registradas' })
  getGrades(@Param('thesisWorkId') id: string) {
    return this.service.getGrades(id);
  }

  @Get()
  @ApiOperation({ summary: 'Ver presentación y acta' })
  findByThesis(@Param('thesisWorkId') id: string) {
    return this.service.findByThesis(id);
  }
}
