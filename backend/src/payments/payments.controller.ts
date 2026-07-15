import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  Res,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
} from '@nestjs/common';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentStatus, UserRole } from '@prisma/client';
import { PaymentsService } from './payments.service';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

class InitiatePaymentDto {
  @ApiProperty({ example: 5000 })
  @IsNumber()
  amount: number;
}

class ConfirmPaymentDto {
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

  @Post('initiate')
  @Roles(UserRole.COORDINATOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Iniciar proceso de pago para un trabajo' })
  initiate(@Param('thesisWorkId') thesisWorkId: string, @Body() dto: InitiatePaymentDto) {
    return this.paymentsService.initiate(thesisWorkId, dto.amount);
  }

  @Post('receipt')
  @Roles(UserRole.STUDENT)
  @UseInterceptors(FileInterceptor('receipt'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Subir comprobante de pago' })
  submitReceipt(
    @Param('thesisWorkId') thesisWorkId: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 })],
      }),
    )
    file: Express.Multer.File,
    @Body('notes') notes?: string,
  ) {
    const receiptUrl = `receipts/${file.originalname}`;
    return this.paymentsService.submitReceipt(thesisWorkId, receiptUrl, file.originalname, notes);
  }

  @Patch('confirm')
  @Roles(UserRole.ADMIN, UserRole.COORDINATOR, UserRole.COBROS)
  @ApiOperation({ summary: 'Confirmar pago (administración)' })
  confirm(
    @Param('thesisWorkId') thesisWorkId: string,
    @Body() dto: ConfirmPaymentDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.paymentsService.confirm(thesisWorkId, userId, dto.notes);
  }

  @Patch('reject')
  @Roles(UserRole.ADMIN, UserRole.COORDINATOR, UserRole.COBROS)
  @ApiOperation({ summary: 'Rechazar comprobante de pago' })
  reject(
    @Param('thesisWorkId') thesisWorkId: string,
    @Body() dto: RejectPaymentDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.paymentsService.reject(thesisWorkId, userId, dto.reason);
  }

  @Get()
  @ApiOperation({ summary: 'Ver estado del pago' })
  findByThesis(@Param('thesisWorkId') thesisWorkId: string) {
    return this.paymentsService.findByThesis(thesisWorkId);
  }
}

// Controlador para listar todos los pagos (admin)
import { Controller as Ctrl } from '@nestjs/common';

@ApiTags('payments')
@ApiBearerAuth('JWT')
@Ctrl('payments')
export class PaymentsAdminController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get('export')
  @Roles(UserRole.ADMIN, UserRole.COORDINATOR, UserRole.COBROS, UserRole.DIRECTOR)
  @ApiOperation({ summary: 'Exportar pagos como CSV' })
  async exportCsv(@Res() res: Response) {
    const csv = await this.paymentsService.exportCsv();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="pagos.csv"');
    res.send('﻿' + csv);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.COORDINATOR, UserRole.COBROS, UserRole.DIRECTOR)
  @ApiOperation({ summary: 'Listar todos los pagos' })
  findAll(@Query('status') status?: PaymentStatus) {
    return this.paymentsService.findAll(status);
  }
}
