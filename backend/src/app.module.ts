import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { HealthController } from './health.controller';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppThrottlerGuard } from './common/guards/app-throttler.guard';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { StudentsModule } from './students/students.module';
import { AdvisorsModule } from './advisors/advisors.module';
import { CareersModule } from './careers/careers.module';
import { ThesisWorksModule } from './thesis-works/thesis-works.module';
import { PaymentsModule } from './payments/payments.module';
import { AdvancesModule } from './advances/advances.module';
import { PresentationsModule } from './presentations/presentations.module';
import { DocumentsModule } from './documents/documents.module';
import { RepositoryModule } from './repository/repository.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AuditModule } from './audit/audit.module';
import { MessagesModule } from './messages/messages.module';
import { ThesisDocumentsModule } from './thesis-documents/thesis-documents.module';
import { DocumentNodesModule } from './document-nodes/document-nodes.module';
import { BlocksModule } from './blocks/blocks.module';
import { ExportsModule } from './exports/exports.module';
import { AiModule } from './ai/ai.module';
import { TemplatesModule } from './templates/templates.module';
import { MeetingsModule } from './meetings/meetings.module';

@Module({
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: AppThrottlerGuard }],
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: Number(config.get('THROTTLE_TTL', 60)) * 1000,
          limit: Number(config.get('THROTTLE_LIMIT', 100)),
        },
      ],
    }),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    UsersModule,
    StudentsModule,
    AdvisorsModule,
    CareersModule,
    ThesisWorksModule,
    PaymentsModule,
    AdvancesModule,
    PresentationsModule,
    DocumentsModule,
    RepositoryModule,
    NotificationsModule,
    AuditModule,
    MessagesModule,
    ThesisDocumentsModule,
    DocumentNodesModule,
    BlocksModule,
    ExportsModule,
    AiModule,
    TemplatesModule,
    MeetingsModule,
  ],
})
export class AppModule {}
