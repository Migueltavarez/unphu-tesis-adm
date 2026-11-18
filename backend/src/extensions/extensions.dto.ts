import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EXTENSION_RULES } from './extension.rules';

export class CreateExtensionDto {
  @ApiProperty({ description: 'Días solicitados' })
  @Type(() => Number) @IsInt()
  @Min(EXTENSION_RULES.minDays, { message: 'Solicita al menos 1 día' })
  @Max(EXTENSION_RULES.maxDays, { message: `El máximo por solicitud es ${EXTENSION_RULES.maxDays} días` })
  days: number;

  @ApiProperty({ description: 'Justificación' })
  @IsString()
  @MinLength(EXTENSION_RULES.minReason, { message: `Justifica la solicitud (mínimo ${EXTENSION_RULES.minReason} caracteres)` })
  @MaxLength(3000)
  reason: string;

  @ApiPropertyOptional({ description: 'Documento de respaldo ya subido al trabajo' })
  @IsOptional() @IsUUID()
  documentId?: string;
}

export class ExtensionDecisionDto {
  @ApiPropertyOptional({ description: 'Nota (obligatoria al rechazar)' })
  @IsOptional() @IsString() @MaxLength(2000)
  note?: string;

  @ApiPropertyOptional({ description: 'Días concedidos (Coordinación); por defecto, los solicitados' })
  @IsOptional() @Type(() => Number) @IsInt()
  @Min(EXTENSION_RULES.minDays) @Max(EXTENSION_RULES.maxDays)
  approvedDays?: number;
}
