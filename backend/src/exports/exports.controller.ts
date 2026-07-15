import { Controller, Get, Param, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ExportsService } from './exports.service';

@ApiTags('exports')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller('thesis-works/:thesisWorkId/document/export')
export class ExportsController {
  constructor(private readonly service: ExportsService) {}

  @Get('docx')
  @ApiOperation({ summary: 'Exportar documento de tesis como DOCX' })
  async exportDocx(
    @Param('thesisWorkId') thesisWorkId: string,
    @CurrentUser('id') userId: string,
    @Res() res: Response,
  ) {
    const { buffer, filename } = await this.service.exportDocx(thesisWorkId, userId);
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }
}
