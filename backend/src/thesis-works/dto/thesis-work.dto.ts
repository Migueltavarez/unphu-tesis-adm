import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsString,
  IsEnum,
  IsOptional,
  IsUUID,
  IsArray,
  IsInt,
  MinLength,
  MaxLength,
} from 'class-validator';
import { WorkType, ThesisStatus } from '@prisma/client';

export class CreateThesisWorkDto {
  @ApiProperty({ example: 'Sistema de Gestión Académica con IA' })
  @IsString()
  @MinLength(10)
  @MaxLength(300)
  title: string;

  @ApiProperty({ enum: WorkType })
  @IsEnum(WorkType)
  type: WorkType;

  @ApiProperty({ example: 'uuid-de-la-carrera' })
  @IsUUID()
  careerId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  abstract?: string;

  @ApiPropertyOptional({ type: [String], example: ['IA', 'Machine Learning', 'Educación'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keywords?: string[];
}

export class UpdateThesisWorkDto extends PartialType(CreateThesisWorkDto) {}

export class UpdateStatusDto {
  @ApiProperty({ enum: ThesisStatus })
  @IsEnum(ThesisStatus)
  status: ThesisStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  rejectionReason?: string;
}

export class AssignAdvisorDto {
  @ApiProperty()
  @IsUUID()
  advisorId: string;
}

export class ThesisWorkQueryDto {
  @ApiPropertyOptional({ enum: ThesisStatus })
  @IsOptional()
  @IsEnum(ThesisStatus)
  status?: ThesisStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  careerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  year?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsInt()
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @IsInt()
  limit?: number = 20;
}
