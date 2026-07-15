import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, MinLength } from 'class-validator';
import { AdvanceStatus } from '@prisma/client';

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
  @MinLength(5)
  content: string;
}

export class ReviewAdvanceDto {
  @ApiProperty({ enum: AdvanceStatus })
  @IsEnum(AdvanceStatus)
  status: AdvanceStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  comment?: string;
}
