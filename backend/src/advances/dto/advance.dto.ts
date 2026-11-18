import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsString, IsOptional, IsIn, IsBoolean, IsArray, ArrayMaxSize, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { AdvanceStatus } from '@prisma/client';
import { FeedbackItemInputDto } from '../../feedback/feedback.dto';

export class CreateAdvanceDto {
  @ApiProperty({ example: 'Capítulo 1 – Introducción' })
  @IsString()
  @MinLength(5)
  title: string;

  @ApiProperty({ example: 'Se completó la introducción y el planteamiento del problema...' })
  @IsString()
  @MinLength(20)
  description: string;
}

export class CreateAdvanceCommentDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(4000)
  content: string;

  @ApiPropertyOptional({ description: 'Hilo privado (asesor, jurado, coordinación): nunca lo ve el estudiante' })
  @IsOptional()
  @IsBoolean()
  isPrivate?: boolean;
}

export class ReviewAdvanceDto {
  @ApiProperty({ enum: [AdvanceStatus.APPROVED, AdvanceStatus.NEEDS_REVISION] })
  @IsIn([AdvanceStatus.APPROVED, AdvanceStatus.NEEDS_REVISION], { message: 'La revisión debe aprobar o solicitar cambios' })
  status: AdvanceStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  comment?: string;

  @ApiPropertyOptional({ description: 'El comentario va al hilo privado' })
  @IsOptional()
  @IsBoolean()
  commentPrivate?: boolean;

  @ApiPropertyOptional({ type: [FeedbackItemInputDto], description: 'Observaciones tipo checklist para esta versión' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => FeedbackItemInputDto)
  items?: FeedbackItemInputDto[];
}
