import { OrderStatus } from '@eatfit/shared';

export class RevenueByDayDto {
  date!: string;
  amount!: string;
  orders!: number;
}

export class PriorPeriodDto {
  totalRevenue!: string;
  orderCount!: number;
  deliveredCount!: number;
  averageOrderValue!: string;
  newCustomers!: number;
}

export class RevenueByPaymentDto {
  method!: string;
  amount!: string;
  orders!: number;
}

export class OrdersByStatusDto {
  status!: OrderStatus;
  count!: number;
}

export class TopItemDto {
  name!: string;
  quantity!: number;
  revenue!: string;
}

export class CustomerMixDto {
  newCustomers!: number;
  repeatCustomers!: number;
}

export class OfferFunnelDto {
  sent!: number;
  opened!: number;
  ordered!: number;
}

export class AnalyticsResponseDto {
  range!: string;
  label!: string;
  totalRevenue!: string;
  orderCount!: number;
  deliveredCount!: number;
  averageOrderValue!: string;
  revenueByPayment!: RevenueByPaymentDto[];
  ordersByStatus!: OrdersByStatusDto[];
  topItems!: TopItemDto[];
  customers!: CustomerMixDto;
  offerFunnel!: OfferFunnelDto;
  revenueByDay!: RevenueByDayDto[];
  priorPeriod!: PriorPeriodDto | null;
}
