import { Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { RiskService } from './risk.service';

@ApiTags('risk')
@ApiBearerAuth('JWT')
@Controller('risk')
export class RiskController {
  constructor(private readonly risk: RiskService) {}

  @Get('summary')
  @Roles(UserRole.ADMIN, UserRole.COORDINATOR, UserRole.DIRECTOR)
  @ApiOperation({ summary: 'Semáforo de seguimiento: conteo por nivel y tesis en riesgo' })
  summary() {
    return this.risk.summary();
  }

  @Post('run-alerts')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Ejecuta ahora el job diario de alertas y recordatorios' })
  runAlerts() {
    return this.risk.runAlerts();
  }
}
