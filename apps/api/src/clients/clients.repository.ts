import { Injectable } from '@nestjs/common';
import { phoneLookupVariants } from '@eatfit/shared';
import { EntityTarget, In, IsNull, Not } from 'typeorm';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { TransactionalRepository } from '../common/database/transactional-repository';
import { BusinessCustomer } from '../businesses/entities/business-customer.entity';
import { Client } from './entities/client.entity';

@Injectable()
export class ClientRepository extends TransactionalRepository<Client> {
  protected readonly entity: EntityTarget<Client> = Client;

  constructor(txHost: TransactionHost<TransactionalAdapterTypeOrm>) {
    super(txHost);
  }

  findByTelegramId(telegramId: string): Promise<Client | null> {
    return this.repo.findOne({ where: { telegramId } });
  }

  /** Веб-аккаунт по телефону (только с паролем — Telegram-клиенты без пароля не участвуют). */
  findWebByPhone(phone: string): Promise<Client | null> {
    const variants = phoneLookupVariants(phone);
    return this.repo.findOne({ where: { phone: In(variants), passwordHash: Not(IsNull()) } });
  }

  /** Любой клиент с этим телефоном (в т.ч. Telegram без пароля). */
  findByPhone(phone: string): Promise<Client | null> {
    const variants = phoneLookupVariants(phone);
    return this.repo.findOne({ where: { phone: In(variants) } });
  }

  findById(id: string): Promise<Client | null> {
    return this.repo.findOne({ where: { id } });
  }

  /** Загрузка клиента с блокировкой строки (для денежных операций; нужна транзакция). */
  findByIdForUpdate(id: string): Promise<Client | null> {
    return this.repo
      .createQueryBuilder('client')
      .setLock('pessimistic_write')
      .where('client.id = :id', { id })
      .getOne();
  }

  /**
   * Поиск клиентов админом по телефону / @username / telegram_id (живой фильтр).
   * Скоупится бизнесом через business_customers — возвращаются ТОЛЬКО клиенты этого тенанта,
   * а не платформенный список.
   */
  search(businessId: string, term?: string): Promise<Client[]> {
    const qb = this.repo
      .createQueryBuilder('client')
      .innerJoin(
        BusinessCustomer,
        'bc',
        'bc.client_id = client.id AND bc.business_id = :businessId',
        { businessId },
      )
      .orderBy('client.createdAt', 'DESC');
    if (term && term.trim()) {
      qb.andWhere(
        '(client.name ILIKE :t OR client.phone ILIKE :t OR client.username ILIKE :t OR CAST(client.telegramId AS TEXT) ILIKE :t)',
        { t: `%${term.trim()}%` },
      );
    }
    return qb.getMany();
  }

  /** Поиск клиентов с CRM-статистикой business_customers. */
  async searchWithCrm(
    businessId: string,
    term?: string,
  ): Promise<
    Array<{
      client: Client;
      ordersCount: number;
      lastOrderAt: Date | null;
      balance: string;
    }>
  > {
    const params: unknown[] = [businessId];
    let filter = '';
    if (term?.trim()) {
      params.push(`%${term.trim()}%`);
      filter = `AND (c.name ILIKE $2 OR c.phone ILIKE $2 OR c.username ILIKE $2 OR CAST(c.telegram_id AS TEXT) ILIKE $2)`;
    }
    const rows: Array<{
      id: string;
      orders_count: string;
      last_order_at: string | null;
      balance: string;
    }> = await this.txHost.tx.query(
      `SELECT c.id,
              bc.orders_count,
              bc.last_order_at,
              bc.balance::text AS balance
       FROM clients c
       INNER JOIN business_customers bc ON bc.client_id = c.id AND bc.business_id = $1
       WHERE 1=1 ${filter}
       ORDER BY bc.last_order_at DESC NULLS LAST, c.created_at DESC`,
      params,
    );
    if (!rows.length) return [];
    const ids = rows.map((r) => r.id);
    const clients = await this.repo.find({ where: { id: In(ids) } });
    const byId = new Map(clients.map((c) => [c.id, c]));
    return rows
      .map((row) => {
        const client = byId.get(row.id);
        if (!client) return null;
        return {
          client,
          ordersCount: Number(row.orders_count ?? 0),
          lastOrderAt: row.last_order_at ? new Date(row.last_order_at) : null,
          balance: row.balance ?? '0',
        };
      })
      .filter((v): v is NonNullable<typeof v> => v != null);
  }

  /** Клиенты сегмента для CRM-рассылок (только с Telegram). */
  findIdsBySegment(businessId: string, segment: string): Promise<string[]> {
    let extra = '';
    switch (segment) {
      case 'has_balance':
        extra = 'AND bc.balance > 0';
        break;
      case 'ordered_30d':
        extra = 'AND bc.last_order_at >= now() - interval \'30 days\'';
        break;
      case 'never_ordered':
        extra = 'AND bc.orders_count = 0';
        break;
      case 'all':
      default:
        extra = '';
        break;
    }
    return this.txHost.tx
      .query(
        `SELECT bc.client_id AS id
         FROM business_customers bc
         INNER JOIN clients c ON c.id = bc.client_id
         WHERE bc.business_id = $1
           AND c.telegram_id IS NOT NULL
           ${extra}`,
        [businessId],
      )
      .then((rows: Array<{ id: string }>) => rows.map((r) => r.id));
  }

  create(data: Partial<Client>): Promise<Client> {
    return this.repo.save(this.repo.create(data));
  }

  save(client: Client): Promise<Client> {
    return this.repo.save(client);
  }

  /** Платформенные админы с паролем (для cold-start / setup wizard). */
  countPlatformAdminsWithPassword(): Promise<number> {
    return this.repo.count({
      where: {
        isPlatformAdmin: true,
        passwordHash: Not(IsNull()),
      },
    });
  }

  async removeById(id: string): Promise<void> {
    await this.repo.delete(id);
  }

  /** Веб-only аккаунт по телефону (без telegramId). */
  findWebOnlyByPhone(phone: string): Promise<Client | null> {
    const variants = phoneLookupVariants(phone);
    return this.repo.findOne({
      where: { phone: In(variants), telegramId: IsNull(), passwordHash: Not(IsNull()) },
    });
  }
}
