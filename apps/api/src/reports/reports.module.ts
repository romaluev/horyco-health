import { Module } from '@nestjs/common';
import { AnalyticsModule } from '../analytics/analytics.module';
import { ReportsService } from './reports.service';
import { ReportsRepository } from './reports.repository';

/**
 * FR-R: итоги дня. SchedulerRegistry — глобальный из ScheduleModule.forRoot (AppModule);
 * NOTIFIER и TransactionHost — глобальные. Экспортирует ReportsService для триггера из бота.
 */
@Module({
  imports: [AnalyticsModule],
  providers: [ReportsService, ReportsRepository],
  exports: [ReportsService],
})
export class ReportsModule {}
