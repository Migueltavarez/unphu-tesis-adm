import { IsString, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CitationStyle } from '@prisma/client';

export class CreateThesisDocumentDto {
  @ApiProperty()
  @IsString()
  title: string;

  @ApiPropertyOptional({ enum: CitationStyle, default: CitationStyle.APA7 })
  @IsOptional()
  @IsEnum(CitationStyle)
  citationStyle?: CitationStyle;
}
