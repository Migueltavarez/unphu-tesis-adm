import { Module } from '@nestjs/common';
import { ThesisWorksService } from './thesis-works.service';
import { ThesisWorksController } from './thesis-works.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  providers: [ThesisWorksService],
  controllers: [ThesisWorksController],
  exports: [ThesisWorksService],
})
export class ThesisWorksModule {}
