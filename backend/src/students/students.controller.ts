import { Controller, Get, Post, Patch, Param, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { StudentsService, CreateStudentProfileDto, UpdateStudentProfileDto } from './students.service';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('students')
@ApiBearerAuth('JWT')
@Controller('students')
export class StudentsController {
  constructor(private readonly service: StudentsService) {}

  @Post('profile')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: 'Crear perfil de estudiante (completar datos académicos)' })
  createProfile(@CurrentUser('id') userId: string, @Body() dto: CreateStudentProfileDto) {
    return this.service.createProfile(userId, dto);
  }

  @Get('me')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: 'Ver mi perfil de estudiante con trabajos' })
  myProfile(@CurrentUser('id') userId: string) {
    return this.service.findByUserId(userId);
  }

  @Patch('me')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: 'Actualizar mi perfil académico' })
  updateMyProfile(@CurrentUser('id') userId: string, @Body() dto: UpdateStudentProfileDto) {
    return this.service.updateMyProfile(userId, dto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.COORDINATOR, UserRole.DIRECTOR, UserRole.REGISTRO)
  @ApiOperation({ summary: 'Listar todos los estudiantes' })
  findAll(@Query('careerId') careerId?: string, @Query('search') search?: string) {
    return this.service.findAll(careerId, search);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.COORDINATOR, UserRole.ADVISOR, UserRole.DIRECTOR, UserRole.REGISTRO)
  @ApiOperation({ summary: 'Ver perfil de estudiante' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id/eligibility')
  @Roles(UserRole.ADMIN, UserRole.COORDINATOR, UserRole.REGISTRO)
  @ApiOperation({ summary: 'Validar elegibilidad del estudiante' })
  validateEligibility(
    @Param('id') id: string,
    @Body() body: { isEligible: boolean; notes?: string },
  ) {
    return this.service.validateEligibility(id, body.isEligible, body.notes);
  }
}
