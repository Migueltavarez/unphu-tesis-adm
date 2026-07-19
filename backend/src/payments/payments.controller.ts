import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  Query,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentStatus, UserRole } from '@prisma/client';
import { PaymentsService } from './payments.service';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

class SetAmountDto {
  @ApiProperty({ example: 5000, description: 'Monto a pagar (RD$)' })
  @IsNumber()
  amount: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

class CajaConfirmDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

class RejectPaymentDto {
  @ApiProperty()
  @IsString()
  reason: string;
}

@ApiTags('payments')
@ApiBearerAuth('JWT')
@Controller('thesis-works/:thesisWorkId/payment')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Patch('set-amount')
  @Roles(UserRole.COBROS, UserRole.ADMIN)
  @ApiOperation({ summary: 'Cobros fija el monto y envía a Caja' })
  setAmount(
    @Param('thesisWorkId') thesisWorkId: string,
    @Body() dto: SetAmountDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.paymentsService.setAmount(thesisWorkId, dto.amount, userId, dto.notes);
  }

  @Patch('caja-confirm')
  @Roles(UserRole.CAJA, UserRole.ADMIN)
  @ApiOperation({ summary: 'Caja confirma recepción del pago' })
  confirmByCaja(
    @Param('thesisWorkId') thesisWorkId: string,
    @Body() dto: CajaConfirmDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.paymentsService.confirmByCaja(thesisWorkId, userId, dto.notes);
  }

  @Patch('reject')
  @Roles(UserRole.ADMIN, UserRole.COORDINATOR, UserRole.COBROS, UserRole.CAJA)
  @ApiOperation({ summary: 'Rechazar / devolver a Cobros' })
  reject(
    @Param('thesisWorkId') thesisWorkId: string,
    @Body() dto: RejectPaymentDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.paymentsService.reject(thesisWorkId, userId, dto.reason);
  }

  @Get()
  @ApiOperation({ summary: 'Ver estado del pago de un trabajo' })
  findByThesis(@Param('thesisWorkId') thesisWorkId: string) {
    return this.paymentsService.findByThesis(thesisWorkId);
  }
}

import { Controller as Ctrl } from '@nestjs/common';

@ApiTags('payments')
@ApiBearerAuth('JWT')
@Ctrl('payments')
export class PaymentsAdminController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get('export')
  @Roles(UserRole.ADMIN, UserRole.COORDINATOR, UserRole.COBROS, UserRole.CAJA, UserRole.DIRECTOR)
  @ApiOperation({ summary: 'Exportar pagos como CSV' })
  async exportCsv(@Res() res: Response) {
    const csv = await this.paymentsService.exportCsv();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="pagos.csv"');
    res.send('﻿' + csv);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.COORDINATOR, UserRole.COBROS, UserRole.CAJA, UserRole.DIRECTOR)
  @ApiOperation({ summary: 'Listar todos los pagos' })
  findAll(@Query('status') status?: PaymentStatus) {
    return this.paymentsService.findAll(status);
  }
}
