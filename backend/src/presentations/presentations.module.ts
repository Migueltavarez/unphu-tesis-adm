import { Module } from '@nestjs/common';
import { PresentationsService } from './presentations.service';
import { PresentationsController } from './presentations.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  providers: [PresentationsService],
  controllers: [PresentationsController],
  exports: [PresentationsService],
})
export class PresentationsModule {}
