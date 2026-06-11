import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { OrderStatus, PaymentMethod } from '@eatfit/shared';
import { Order } from '../orders/entities/order.entity';
import { OrderItem } from '../orders/entities/order-item.entity';
import { OfferRecipientStatus } from '../offers/entities/offer.entity';

export interface RevenueRow {
  paymentMethod: PaymentMethod;
  total: string;
  orders: string;
}

export interface StatusRow {
  status: OrderStatus;
  count: string;
}

export interface TopItemRow {
  name: string;
  quantity: string;
  revenue: string;
}

export interface CustomerMixRow {
  newCustomers: string;
  repeatCustomers: string;
}

export interface OfferFunnelRow {
  sent: string;
  opened: string;
  ordered: string;
}

@Injectable()
export class AnalyticsRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>) {}

  private get m() {
    return this.txHost.tx;
  }

  ordersInRange(businessId: string, start: Date, end: Date): Promise<Order[]> {
    return this.m
      .getRepository(Order)
      .createQueryBuilder('o')
      .where('o.business_id = :businessId', { businessId })
      .andWhere('o.created_at >= :start AND o.created_at < :end', { start, end })
      .getMany();
  }

  revenueByPayment(businessId: string, start: Date, end: Date): Promise<RevenueRow[]> {
    return this.m.query(
      `SELECT o.payment_method AS "paymentMethod",
              COALESCE(SUM(o.total), 0)::text AS total,
              COUNT(*)::text AS orders
       FROM orders o
       WHERE o.business_id = $1
         AND o.status = $2
         AND o.created_at >= $3 AND o.created_at < $4
       GROUP BY o.payment_method`,
      [businessId, OrderStatus.Done, start, end],
    );
  }

  ordersByStatus(businessId: string, start: Date, end: Date): Promise<StatusRow[]> {
    return this.m.query(
      `SELECT o.status AS status, COUNT(*)::text AS count
       FROM orders o
       WHERE o.business_id = $1
         AND o.created_at >= $2 AND o.created_at < $3
       GROUP BY o.status`,
      [businessId, start, end],
    );
  }

  topItems(businessId: string, start: Date, end: Date, limit = 10): Promise<TopItemRow[]> {
    return this.m.query(
      `SELECT COALESCE(oi.name_ru_snapshot, '—') AS name,
              SUM(oi.quantity)::text AS quantity,
              COALESCE(SUM(oi.price_at_order * oi.quantity), 0)::text AS revenue
       FROM order_items oi
       INNER JOIN orders o ON o.id = oi.order_id
       WHERE o.business_id = $1
         AND o.status = $2
         AND o.created_at >= $3 AND o.created_at < $4
       GROUP BY COALESCE(oi.name_ru_snapshot, '—')
       ORDER BY SUM(oi.quantity) DESC
       LIMIT $5`,
      [businessId, OrderStatus.Done, start, end, limit],
    );
  }

  customerMix(businessId: string, start: Date, end: Date): Promise<CustomerMixRow> {
    return this.m
      .query(
        `SELECT
           COUNT(DISTINCT o.client_id) FILTER (
             WHERE bc.first_order_at IS NOT NULL
               AND bc.first_order_at >= $3 AND bc.first_order_at < $4
           )::text AS "newCustomers",
           COUNT(DISTINCT o.client_id) FILTER (
             WHERE bc.first_order_at IS NOT NULL
               AND bc.first_order_at < $3
           )::text AS "repeatCustomers"
         FROM orders o
         INNER JOIN business_customers bc
           ON bc.business_id = o.business_id AND bc.client_id = o.client_id
         WHERE o.business_id = $1
           AND o.status = $2
           AND o.created_at >= $3 AND o.created_at < $4`,
        [businessId, OrderStatus.Done, start, end],
      )
      .then((rows: CustomerMixRow[]) => rows[0] ?? { newCustomers: '0', repeatCustomers: '0' });
  }

  /** Воронка CRM-рассылок: получатели офферов, отправленных в период. */
  offerFunnel(businessId: string, start: Date, end: Date): Promise<OfferFunnelRow> {
    return this.m
      .query(
        `SELECT
           COUNT(*) FILTER (WHERE r.status IN ($4, $5, $6, $7))::text AS sent,
           COUNT(*) FILTER (WHERE r.status IN ($5, $6))::text AS opened,
           COUNT(*) FILTER (WHERE r.status = $6)::text AS ordered
         FROM offer_recipients r
         INNER JOIN offers off ON off.id = r.offer_id
         WHERE off.business_id = $1
           AND off.sent_at IS NOT NULL
           AND off.sent_at >= $2 AND off.sent_at < $3`,
        [
          businessId,
          start,
          end,
          OfferRecipientStatus.Sent,
          OfferRecipientStatus.Opened,
          OfferRecipientStatus.Ordered,
          OfferRecipientStatus.Failed,
        ],
      )
      .then((rows: OfferFunnelRow[]) => rows[0] ?? { sent: '0', opened: '0', ordered: '0' });
  }
}
