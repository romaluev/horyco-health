import { Injectable } from '@nestjs/common';
import { EntityTarget } from 'typeorm';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { TransactionalRepository } from '../common/database/transactional-repository';
import { Money } from '../common/money/money';
import { BusinessCustomer } from './entities/business-customer.entity';

@Injectable()
export class BusinessCustomersRepository extends TransactionalRepository<BusinessCustomer> {
  protected readonly entity: EntityTarget<BusinessCustomer> = BusinessCustomer;

  constructor(txHost: TransactionHost<TransactionalAdapterTypeOrm>) {
    super(txHost);
  }

  find(businessId: string, clientId: string): Promise<BusinessCustomer | null> {
    return this.repo.findOne({ where: { businessId, clientId } });
  }

  /**
   * Кошелёк под блокировкой строки (денежные операции). Строка создаётся лениво
   * при первом касании: INSERT … ON CONFLICT DO NOTHING, затем SELECT … FOR UPDATE.
   */
  async findForUpdateOrCreate(businessId: string, clientId: string): Promise<BusinessCustomer> {
    await this.txHost.tx.query(
      `INSERT INTO business_customers (business_id, client_id)
       VALUES ($1, $2) ON CONFLICT (business_id, client_id) DO NOTHING`,
      [businessId, clientId],
    );
    const row = await this.repo
      .createQueryBuilder('bc')
      .setLock('pessimistic_write')
      .where('bc.businessId = :businessId AND bc.clientId = :clientId', { businessId, clientId })
      .getOne();
    if (!row) {
      throw new Error('business_customers: строка не найдена после upsert');
    }
    return row;
  }

  /** Регистрация касания клиента (вне денежных операций): создать строку CRM, если её нет. */
  async ensureExists(businessId: string, clientId: string): Promise<void> {
    await this.txHost.tx.query(
      `INSERT INTO business_customers (business_id, client_id)
       VALUES ($1, $2) ON CONFLICT (business_id, client_id) DO NOTHING`,
      [businessId, clientId],
    );
  }

  /** Статистика заказов клиента у бизнеса (в транзакции создания заказа). */
  async bumpOrderStats(businessId: string, clientId: string): Promise<void> {
    await this.txHost.tx.query(
      `UPDATE business_customers
       SET orders_count = orders_count + 1,
           first_order_at = COALESCE(first_order_at, now()),
           last_order_at = now(),
           updated_at = now()
       WHERE business_id = $1 AND client_id = $2`,
      [businessId, clientId],
    );
  }

  save(row: BusinessCustomer): Promise<BusinessCustomer> {
    return this.repo.save(row);
  }

  /**
   * Балансы сразу для нескольких клиентов одного бизнеса (один запрос, без N+1).
   * Используется при постраничном выводе списка клиентов.
   * Отсутствующие строки в Map означают нулевой баланс — вызывающий подставляет Money.zero().
   */
  async balancesFor(businessId: string, clientIds: string[]): Promise<Map<string, Money>> {
    if (!clientIds.length) return new Map();
    const rows = await this.repo
      .createQueryBuilder('bc')
      .select(['bc.clientId', 'bc.balance'])
      .where('bc.businessId = :businessId AND bc.clientId = ANY(:ids)', {
        businessId,
        ids: clientIds,
      })
      .getMany();
    const map = new Map<string, Money>();
    for (const row of rows) {
      map.set(row.clientId, row.balance);
    }
    return map;
  }
}
