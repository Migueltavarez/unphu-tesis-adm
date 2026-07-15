import { IsString, IsOptional, IsNumber, IsEnum, IsObject, IsInt, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BlockType } from '@prisma/client';
import { Type } from 'class-transformer';

export class CreateBlockDto {
  @ApiPropertyOptional({ enum: BlockType })
  @IsOptional()
  @IsEnum(BlockType)
  type?: BlockType;

  @ApiProperty()
  @IsObject()
  content: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  order?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  wordCount?: number;
}

export class UpdateBlockDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  content?: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  order?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  wordCount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class SaveVersionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  message?: string;
}

export class ReorderBlocksDto {
  @ApiProperty({ type: [Object] })
  items: { id: string; order: number }[];
}
