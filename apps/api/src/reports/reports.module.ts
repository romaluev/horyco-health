import { Global, Module } from '@nestjs/common';
import { AnalyticsModule } from '../analytics/analytics.module';
import { ReportsService } from './reports.service';
import { ReportsRepository } from './reports.repository';

/**
 * FR-R: итоги дня. @Global — ReportsService нужен StaffUpdate в TelegramModule без
 * вложенного import (NOTIFIER ↔ ReportsService deadlock при nested import).
 */
@Global()
@Module({
  imports: [AnalyticsModule],
  providers: [ReportsService, ReportsRepository],
  exports: [ReportsService],
})
export class ReportsModule {}
