import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { DocumentNodesService } from './document-nodes.service';
import { AiService } from '../ai/ai.service';
import {
  CreateDocumentNodeDto,
  UpdateDocumentNodeDto,
  MoveNodeDto,
  ReorderNodesDto,
  AddCommentDto,
  TransitionDto,
  SaveNodeVersionDto,
} from './dto/document-node.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { NodeStatus, UserRole } from '@prisma/client';

// ─── Nested under /thesis-documents/:documentId/nodes ────────

@Controller({ path: 'thesis-documents/:documentId/nodes', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
export class DocumentNodesDocumentController {
  constructor(private readonly service: DocumentNodesService) {}

  @Get()
  getTree(@Param('documentId') documentId: string) {
    return this.service.findTree(documentId);
  }

  @Post()
  create(
    @Param('documentId') documentId: string,
    @Body() dto: CreateDocumentNodeDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.service.create(documentId, dto, userId);
  }

  @Patch('reorder')
  reorder(@Body() dto: ReorderNodesDto) {
    return this.service.reorder(dto.items);
  }
}

// ─── Flat /document-nodes/:id ────────────────────────────────

@Controller({ path: 'document-nodes', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
export class DocumentNodesController {
  constructor(
    private readonly service: DocumentNodesService,
    private readonly aiService: AiService,
  ) {}

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateDocumentNodeDto) {
    return this.service.update(id, dto);
  }

  @Patch(':id/move')
  move(@Param('id') id: string, @Body() dto: MoveNodeDto) {
    return this.service.move(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  // ─── State transitions ──────────────────────────────────────

  @Patch(':id/start')
  start(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
  ) {
    return this.service.transition(id, NodeStatus.IN_PROGRESS, userId, role);
  }

  @Patch(':id/submit')
  submit(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
    @Body() dto: TransitionDto,
  ) {
    return this.service.transition(id, NodeStatus.PENDING_REVIEW, userId, role, dto.notes);
  }

  @Patch(':id/approve')
  @Roles(UserRole.ADVISOR, UserRole.COORDINATOR, UserRole.ADMIN)
  approve(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
    @Body() dto: TransitionDto,
  ) {
    return this.service.transition(id, NodeStatus.APPROVED, userId, role, dto.notes);
  }

  @Patch(':id/return')
  @Roles(UserRole.ADVISOR, UserRole.COORDINATOR, UserRole.ADMIN)
  returnNode(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
    @Body() dto: TransitionDto,
  ) {
    return this.service.transition(id, NodeStatus.RETURNED, userId, role, dto.notes);
  }

  // ─── Comments ───────────────────────────────────────────────

  @Post(':id/comments')
  addComment(
    @Param('id') id: string,
    @Body() dto: AddCommentDto,
    @CurrentUser('id') userId: string,
    @CurrentUser() user: any,
  ) {
    const authorName = `${user.firstName} ${user.lastName}`.trim();
    return this.service.addComment(id, dto, userId, authorName);
  }

  @Patch('comments/:commentId/resolve')
  resolveComment(
    @Param('commentId') commentId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.service.resolveComment(commentId, userId);
  }

  // ─── Versions ───────────────────────────────────────────────

  @Get(':id/versions')
  listVersions(@Param('id') id: string) {
    return this.service.listVersions(id);
  }

  @Post(':id/versions')
  saveVersion(
    @Param('id') id: string,
    @Body() dto: SaveNodeVersionDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.service.saveVersion(id, dto, userId);
  }

  // ─── AI assistance ──────────────────────────────────────────

  @Post(':id/ai/:action')
  async streamAi(
    @Param('id') nodeId: string,
    @Param('action') action: string,
    @CurrentUser('id') userId: string,
    @Res() res: Response,
  ) {
    return this.aiService.streamNodeAi(nodeId, action as any, userId, res);
  }
}
