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
  PriorPeriodDto,
  RevenueByDayDto,
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
    const priorPeriod = this.priorPeriod(period, range, business.tzOffsetHours);

    const orders = await this.repo.ordersInRange(businessId, period.start, period.end);
    const done = orders.filter((o) => o.status === OrderStatus.Done);

    let totalRevenue = Money.zero();
    for (const o of done) totalRevenue = totalRevenue.add(o.total);
    const aov = done.length
      ? Money.fromMajor(Number(totalRevenue.toString()) / done.length)
      : Money.zero();

    const [
      revRows,
      statusRows,
      topRows,
      customerRow,
      funnelRow,
      dayRows,
      priorOrders,
      priorRevRows,
      priorCustomerRow,
    ] = await Promise.all([
      this.repo.revenueByPayment(businessId, period.start, period.end),
      this.repo.ordersByStatus(businessId, period.start, period.end),
      this.repo.topItems(businessId, period.start, period.end),
      this.repo.customerMix(businessId, period.start, period.end),
      this.repo.offerFunnel(businessId, period.start, period.end),
      this.repo.revenueByDay(businessId, period.start, period.end),
      priorPeriod
        ? this.repo.ordersInRange(businessId, priorPeriod.start, priorPeriod.end)
        : Promise.resolve([]),
      priorPeriod
        ? this.repo.revenueByPayment(businessId, priorPeriod.start, priorPeriod.end)
        : Promise.resolve([]),
      priorPeriod
        ? this.repo.customerMix(businessId, priorPeriod.start, priorPeriod.end)
        : Promise.resolve({ newCustomers: '0', repeatCustomers: '0' }),
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

    const revenueByDay: RevenueByDayDto[] = dayRows.map((r) => ({
      date: r.date,
      amount: Money.fromMajor(r.total).toString(),
      orders: Number(r.orders),
    }));

    let prior: PriorPeriodDto | null = null;
    if (priorPeriod) {
      const priorDone = priorOrders.filter((o) => o.status === OrderStatus.Done);
      let priorRevenue = Money.zero();
      for (const o of priorDone) priorRevenue = priorRevenue.add(o.total);
      const priorAov = priorDone.length
        ? Money.fromMajor(Number(priorRevenue.toString()) / priorDone.length)
        : Money.zero();
      prior = {
        totalRevenue: priorRevenue.toString(),
        orderCount: priorOrders.length,
        deliveredCount: priorDone.length,
        averageOrderValue: priorAov.toString(),
        newCustomers: Number(priorCustomerRow.newCustomers),
      };
    }

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
      revenueByDay,
      priorPeriod: prior,
    };
  }

  /** Предыдущий период той же длины для сравнения KPI. */
  private priorPeriod(
    current: { start: Date; end: Date },
    range: 'today' | '7d' | '30d',
    tzOffsetHours: number,
  ): { start: Date; end: Date } | null {
    const durationMs = current.end.getTime() - current.start.getTime();
    if (durationMs <= 0) return null;
    const end = new Date(current.start.getTime());
    const start = new Date(end.getTime() - durationMs);
    if (range === 'today') {
      return analyticsPeriod('today', tzOffsetHours, end.getTime() - 24 * 3_600_000);
    }
    return { start, end };
  }
}
