import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { OrderStatus } from '@eatfit/shared';
import { Order } from '../orders/entities/order.entity';
import { OrderItem } from '../orders/entities/order-item.entity';
import { Deposit } from '../deposits/entities/deposit.entity';
import { Client } from '../clients/entities/client.entity';

/**
 * Чтение агрегатов за период для отчёта (FR-R). Только SELECT'ы; денежные суммы считаются
 * в сервисе на Money (значения приходят как VO через трансформер). Доступ к нескольким
 * таблицам через активный менеджер CLS — отдельный репозиторий-агрегатор.
 */
@Injectable()
export class ReportsRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>) {}

  private get m() {
    return this.txHost.tx;
  }

  /** Заказы, созданные в [start, end). */
  ordersInRange(start: Date, end: Date): Promise<Order[]> {
    return this.m
      .getRepository(Order)
      .createQueryBuilder('o')
      .where('o.created_at >= :start AND o.created_at < :end', { start, end })
      .getMany();
  }

  /** Позиции доставленных заказов за период (для топа блюд) с блюдом. */
  doneItemsInRange(start: Date, end: Date): Promise<OrderItem[]> {
    return this.m
      .getRepository(OrderItem)
      .createQueryBuilder('oi')
      // withDeleted: блюдо могло быть удалено (soft-delete) после доставки заказа —
      // без этого innerJoin отсеет такие позиции и занизит выручку/топ блюд в отчёте.
      .withDeleted()
      .innerJoinAndSelect('oi.menuItem', 'm')
      .innerJoin('oi.order', 'o')
      .where('o.status = :done AND o.created_at >= :start AND o.created_at < :end', {
        done: OrderStatus.Done,
        start,
        end,
      })
      .getMany();
  }

  /** Пополнения за период. */
  depositsInRange(start: Date, end: Date): Promise<Deposit[]> {
    return this.m
      .getRepository(Deposit)
      .createQueryBuilder('d')
      .where('d.created_at >= :start AND d.created_at < :end', { start, end })
      .getMany();
  }

  /** Число новых клиентов за период. */
  clientsCountInRange(start: Date, end: Date): Promise<number> {
    return this.m
      .getRepository(Client)
      .createQueryBuilder('c')
      .where('c.created_at >= :start AND c.created_at < :end', { start, end })
      .getCount();
  }
}
