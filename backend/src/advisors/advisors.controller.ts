import { Controller, Get, Post, Patch, Param, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { AdvisorsService, UpdateAdvisorDto } from './advisors.service';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('advisors')
@ApiBearerAuth('JWT')
@Controller('advisors')
export class AdvisorsController {
  constructor(private readonly service: AdvisorsService) {}

  @Post('profile')
  @Roles(UserRole.ADVISOR)
  @ApiOperation({ summary: 'Crear perfil de asesor' })
  createProfile(@CurrentUser('id') userId: string, @Body() dto: UpdateAdvisorDto) {
    return this.service.createProfile(userId, dto);
  }

  @Get('me')
  @Roles(UserRole.ADVISOR)
  @ApiOperation({ summary: 'Ver mis trabajos asignados' })
  myProfile(@CurrentUser('id') userId: string) {
    return this.service.findByUserId(userId);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.COORDINATOR)
  @ApiOperation({ summary: 'Listar todos los asesores' })
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.COORDINATOR)
  @ApiOperation({ summary: 'Ver perfil de asesor' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.ADVISOR)
  @ApiOperation({ summary: 'Actualizar perfil de asesor' })
  update(@Param('id') id: string, @Body() dto: UpdateAdvisorDto) {
    return this.service.update(id, dto);
  }
}
