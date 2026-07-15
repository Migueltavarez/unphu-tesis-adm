import { Controller, Post, Param, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AiService } from './ai.service';

@ApiTags('ai')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller('sections/:sectionId/ai')
export class AiController {
  constructor(private readonly service: AiService) {}

  @Post(':action')
  @ApiOperation({ summary: 'Asistente AI para sección de tesis (streaming SSE)' })
  @ApiQuery({ name: 'action', enum: ['suggest', 'improve', 'summarize', 'outline', 'references'] })
  async streamAi(
    @Param('sectionId') sectionId: string,
    @Param('action') action: string,
    @CurrentUser('id') userId: string,
    @Res() res: Response,
  ) {
    return this.service.streamSectionAi(sectionId, action as any, userId, res);
  }
}
