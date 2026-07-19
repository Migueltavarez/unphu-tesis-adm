import { Module } from '@nestjs/common';
import { DocumentNodesService } from './document-nodes.service';
import {
  DocumentNodesController,
  DocumentNodesDocumentController,
} from './document-nodes.controller';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [AiModule],
  providers: [DocumentNodesService],
  controllers: [DocumentNodesController, DocumentNodesDocumentController],
  exports: [DocumentNodesService],
})
export class DocumentNodesModule {}
