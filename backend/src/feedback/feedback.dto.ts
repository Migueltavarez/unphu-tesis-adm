import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FeedbackCategory, FeedbackSeverity } from '@prisma/client';

export class FeedbackItemInputDto {
  @ApiProperty({ enum: FeedbackCategory })
  @IsEnum(FeedbackCategory, { message: 'Categoría no válida' })
  category: FeedbackCategory;

  @ApiProperty({ enum: FeedbackSeverity })
  @IsEnum(FeedbackSeverity, { message: 'Severidad no válida' })
  severity: FeedbackSeverity;

  @ApiProperty({ description: 'Qué debe corregirse' })
  @IsString() @MinLength(3, { message: 'Describe la observación (mínimo 3 caracteres)' }) @MaxLength(2000)
  text: string;

  @ApiPropertyOptional({ description: 'Dónde: capítulo, sección o página' })
  @IsOptional() @IsString() @MaxLength(120)
  location?: string;
}

export class CreateFeedbackDto {
  @ApiProperty({ type: [FeedbackItemInputDto] })
  @IsArray() @ArrayMinSize(1, { message: 'Agrega al menos una observación' }) @ArrayMaxSize(30)
  @ValidateNested({ each: true }) @Type(() => FeedbackItemInputDto)
  items: FeedbackItemInputDto[];
}

export class FeedbackNoteDto {
  @ApiPropertyOptional({ description: 'Cómo se resolvió / por qué se reabre' })
  @IsOptional() @IsString() @MaxLength(1000)
  note?: string;
}
