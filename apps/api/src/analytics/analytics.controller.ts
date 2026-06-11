import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { BusinessAdminGuard } from '../auth/guards/business-admin.guard';
import { AnalyticsService } from './analytics.service';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';

@Controller('b/analytics')
@UseGuards(BusinessAdminGuard)
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get()
  dashboard(@Query() query: AnalyticsQueryDto) {
    return this.analytics.getDashboard(query.range);
  }
}
