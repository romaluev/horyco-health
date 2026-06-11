import { Injectable } from '@nestjs/common';
import { OrderStatus } from '@eatfit/shared';
import { ActorContextService } from '../common/cls/actor-context.service';
import { NotFoundError } from '../common/errors/domain-error';
import { Money } from '../common/money/money';
import { BusinessesRepository } from '../businesses/businesses.repository';
import { AnalyticsRepository } from './analytics.repository';
import { analyticsPeriod, parseAnalyticsRange } from './analytics-range';
import {
  AnalyticsResponseDto,
  CustomerMixDto,
  OfferFunnelDto,
  OrdersByStatusDto,
  RevenueByPaymentDto,
  TopItemDto,
} from './dto/analytics-response.dto';

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly repo: AnalyticsRepository,
    private readonly businesses: BusinessesRepository,
    private readonly actorCtx: ActorContextService,
  ) {}

  async getDashboard(rangeRaw?: string): Promise<AnalyticsResponseDto> {
    const businessId = this.actorCtx.getOrThrow().businessId;
    const business = await this.businesses.findById(businessId);
    if (!business) throw new NotFoundError('Бизнес не найден');

    const range = parseAnalyticsRange(rangeRaw);
    const period = analyticsPeriod(range, business.tzOffsetHours);

    const orders = await this.repo.ordersInRange(businessId, period.start, period.end);
    const done = orders.filter((o) => o.status === OrderStatus.Done);

    let totalRevenue = Money.zero();
    for (const o of done) totalRevenue = totalRevenue.add(o.total);
    const aov = done.length
      ? Money.fromMajor(Number(totalRevenue.toString()) / done.length)
      : Money.zero();

    const [revRows, statusRows, topRows, customerRow, funnelRow] = await Promise.all([
      this.repo.revenueByPayment(businessId, period.start, period.end),
      this.repo.ordersByStatus(businessId, period.start, period.end),
      this.repo.topItems(businessId, period.start, period.end),
      this.repo.customerMix(businessId, period.start, period.end),
      this.repo.offerFunnel(businessId, period.start, period.end),
    ]);

    const revenueByPayment: RevenueByPaymentDto[] = revRows.map((r) => ({
      method: r.paymentMethod,
      amount: Money.fromMajor(r.total).toString(),
      orders: Number(r.orders),
    }));

    const ordersByStatus: OrdersByStatusDto[] = statusRows.map((r) => ({
      status: r.status,
      count: Number(r.count),
    }));

    const topItems: TopItemDto[] = topRows.map((r) => ({
      name: r.name,
      quantity: Number(r.quantity),
      revenue: Money.fromMajor(r.revenue).toString(),
    }));

    const customers: CustomerMixDto = {
      newCustomers: Number(customerRow.newCustomers),
      repeatCustomers: Number(customerRow.repeatCustomers),
    };

    const offerFunnel: OfferFunnelDto = {
      sent: Number(funnelRow.sent),
      opened: Number(funnelRow.opened),
      ordered: Number(funnelRow.ordered),
    };

    return {
      range: period.range,
      label: period.label,
      totalRevenue: totalRevenue.toString(),
      orderCount: orders.length,
      deliveredCount: done.length,
      averageOrderValue: aov.toString(),
      revenueByPayment,
      ordersByStatus,
      topItems,
      customers,
      offerFunnel,
    };
  }
}
