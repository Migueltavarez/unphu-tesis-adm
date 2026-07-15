import { IsString, IsOptional, IsBoolean, IsArray, ValidateNested, IsEnum, IsNumber, IsInt } from 'class-validator';
import { Type } from 'class-transformer';
import { SectionType } from '@prisma/client';

export class CreateTemplateSectionDto {
  @IsEnum(SectionType)
  @IsOptional()
  type?: SectionType;

  @IsString()
  title: string;

  @IsNumber()
  @IsOptional()
  order?: number;

  @IsBoolean()
  @IsOptional()
  isRequired?: boolean;

  @IsInt()
  @IsOptional()
  minWords?: number;

  @IsInt()
  @IsOptional()
  maxWords?: number;

  @IsString()
  @IsOptional()
  guidance?: string;
}

export class CreateTemplateDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  careerId?: string;

  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateTemplateSectionDto)
  @IsOptional()
  sections?: CreateTemplateSectionDto[];
}
