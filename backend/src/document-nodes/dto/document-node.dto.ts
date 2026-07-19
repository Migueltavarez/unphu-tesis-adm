import { IsString, IsOptional, IsBoolean, IsNumber, IsObject, IsEnum } from 'class-validator';
import { NodeStatus } from '@prisma/client';

export class CreateDocumentNodeDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  nodeType?: string;

  @IsString()
  @IsOptional()
  parentId?: string;

  @IsNumber()
  @IsOptional()
  order?: number;

  @IsBoolean()
  @IsOptional()
  isRequired?: boolean;

  @IsBoolean()
  @IsOptional()
  isOptional?: boolean;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}

export class UpdateDocumentNodeDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  nodeType?: string;

  @IsBoolean()
  @IsOptional()
  isRequired?: boolean;

  @IsBoolean()
  @IsOptional()
  isOptional?: boolean;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}

export class MoveNodeDto {
  @IsString()
  @IsOptional()
  parentId?: string | null;

  @IsNumber()
  order: number;
}

export class ReorderNodesDto {
  items: { id: string; order: number }[];
}

export class AddCommentDto {
  @IsString()
  content: string;

  @IsString()
  @IsOptional()
  blockId?: string;

  @IsString()
  @IsOptional()
  parentId?: string;

  @IsString()
  @IsOptional()
  priority?: string;
}

export class TransitionDto {
  @IsString()
  @IsOptional()
  notes?: string;
}

export class SaveNodeVersionDto {
  @IsString()
  @IsOptional()
  label?: string;
}
