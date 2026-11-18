import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ThesisStatus } from '@prisma/client';
import { MILESTONE_STATUSES } from './milestone-plan';

export class MilestoneTemplateItemDto {
  @ApiPropertyOptional({ description: 'Id del hito existente (omitir para uno nuevo)' })
  @IsOptional() @IsUUID()
  id?: string;

  @ApiProperty() @IsString() @MinLength(2) @MaxLength(120)
  name: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500)
  description?: string;

  @ApiProperty({ description: 'Días desde el inicio del trabajo' })
  @Type(() => Number) @IsInt() @Min(0) @Max(3650)
  daysFromStart: number;

  @ApiPropertyOptional({ default: true }) @IsOptional() @IsBoolean()
  required?: boolean;

  @ApiPropertyOptional({ enum: MILESTONE_STATUSES, nullable: true, description: 'Etapa que lo cumple automáticamente; null = manual' })
  @IsOptional() @IsIn([...MILESTONE_STATUSES, null], { message: 'La etapa elegida no se puede usar para cumplir un hito automáticamente' })
  completesAtStatus?: ThesisStatus | null;
}

export class UpdateMilestonePlanDto {
  @ApiProperty({ description: 'Duración esperada (meses)' })
  @Type(() => Number) @IsInt() @Min(1) @Max(120)
  expectedMonths: number;

  @ApiProperty({ description: 'Duración máxima permitida (meses)' })
  @Type(() => Number) @IsInt() @Min(1) @Max(120)
  maxMonths: number;

  @ApiProperty({ type: [MilestoneTemplateItemDto] })
  @IsArray() @ArrayMaxSize(40)
  @ValidateNested({ each: true }) @Type(() => MilestoneTemplateItemDto)
  milestones: MilestoneTemplateItemDto[];
}
