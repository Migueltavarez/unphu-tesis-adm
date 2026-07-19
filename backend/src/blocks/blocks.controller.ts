import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { BlocksService } from './blocks.service';
import { CreateBlockDto, UpdateBlockDto, SaveVersionDto, ReorderBlocksDto } from './dto/block.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

// ─── Blocks nested under /document-nodes/:nodeId/blocks ──────

@Controller({ path: 'document-nodes/:nodeId/blocks', version: '1' })
@UseGuards(JwtAuthGuard)
export class BlocksNodeController {
  constructor(private readonly service: BlocksService) {}

  @Get()
  findAll(@Param('nodeId') nodeId: string) {
    return this.service.findByNode(nodeId);
  }

  @Post()
  create(
    @Param('nodeId') nodeId: string,
    @Body() dto: CreateBlockDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.service.create(nodeId, dto, userId);
  }

  @Patch('reorder')
  reorder(@Body() dto: ReorderBlocksDto) {
    return this.service.reorder(dto.items);
  }
}

// ─── Flat /blocks/:id ────────────────────────────────────────

@Controller({ path: 'blocks', version: '1' })
@UseGuards(JwtAuthGuard)
export class BlocksController {
  constructor(private readonly service: BlocksService) {}

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateBlockDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.service.update(id, dto, userId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.service.softDelete(id, userId);
  }

  @Get(':id/versions')
  listVersions(@Param('id') id: string) {
    return this.service.listVersions(id);
  }

  @Post(':id/versions')
  saveVersion(
    @Param('id') id: string,
    @Body() dto: SaveVersionDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.service.saveVersion(id, dto, userId);
  }

  @Patch(':id/restore/:versionNum')
  restore(
    @Param('id') id: string,
    @Param('versionNum') versionNum: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.service.restoreVersion(id, parseInt(versionNum, 10), userId);
  }
}
