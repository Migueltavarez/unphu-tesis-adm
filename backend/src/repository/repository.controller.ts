import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { RepositoryService, RepositoryQueryDto } from './repository.service';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('repository')
@Controller('repository')
export class RepositoryController {
  constructor(private readonly service: RepositoryService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Listar proyectos publicados (acceso público)' })
  findAll(@Query() query: RepositoryQueryDto) {
    return this.service.findPublished(query);
  }

  @Public()
  @Get('stats')
  @ApiOperation({ summary: 'Estadísticas del repositorio público' })
  getStats() {
    return this.service.getStats();
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Ver detalle de proyecto publicado' })
  findOne(@Param('id') id: string) {
    return this.service.findOnePublished(id);
  }
}
