import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class CreateTemplateDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  docType?: string;

  @IsString()
  @IsOptional()
  careerId?: string;

  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;

  nodes?: any[];
}
