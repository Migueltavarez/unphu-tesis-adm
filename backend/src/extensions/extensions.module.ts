import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ExtensionsService } from './extensions.service';
import { ExtensionsController } from './extensions.controller';

@Module({
  imports: [AuditModule, NotificationsModule],
  providers: [ExtensionsService],
  controllers: [ExtensionsController],
  exports: [ExtensionsService],
})
export class ExtensionsModule {}
