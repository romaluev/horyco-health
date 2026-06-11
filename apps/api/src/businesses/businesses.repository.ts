import { Injectable } from '@nestjs/common';
import { EntityTarget } from 'typeorm';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { BotStatus, BusinessStatus } from '@eatfit/shared';
import { TransactionalRepository } from '../common/database/transactional-repository';
import { Business } from './entities/business.entity';

@Injectable()
export class BusinessesRepository extends TransactionalRepository<Business> {
  protected readonly entity: EntityTarget<Business> = Business;

  constructor(txHost: TransactionHost<TransactionalAdapterTypeOrm>) {
    super(txHost);
  }

  findById(id: string): Promise<Business | null> {
    return this.repo.findOne({ where: { id } });
  }

  findBySlug(slug: string): Promise<Business | null> {
    return this.repo.findOne({ where: { slug } });
  }

  findByBotId(botId: string): Promise<Business | null> {
    return this.repo.findOne({ where: { botId } });
  }

  findAll(): Promise<Business[]> {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  create(data: Partial<Business>): Promise<Business> {
    return this.repo.save(this.repo.create(data));
  }

  async countByStatus(): Promise<{
    total: number;
    active: number;
    onboarding: number;
    suspended: number;
    withBot: number;
  }> {
    const rows: {
      total: string;
      active: string;
      onboarding: string;
      suspended: string;
      with_bot: string;
    }[] = await this.txHost.tx.query(
      `SELECT COUNT(*)::text AS total,
              COUNT(*) FILTER (WHERE status = 'active')::text AS active,
              COUNT(*) FILTER (WHERE status = 'onboarding')::text AS onboarding,
              COUNT(*) FILTER (WHERE status = 'suspended')::text AS suspended,
              COUNT(*) FILTER (WHERE bot_id IS NOT NULL)::text AS with_bot
       FROM businesses WHERE deleted_at IS NULL`,
    );
    const r = rows[0];
    return {
      total: Number(r?.total ?? 0),
      active: Number(r?.active ?? 0),
      onboarding: Number(r?.onboarding ?? 0),
      suspended: Number(r?.suspended ?? 0),
      withBot: Number(r?.with_bot ?? 0),
    };
  }

  async countOrders(): Promise<number> {
    const rows: { cnt: string }[] = await this.txHost.tx.query(
      `SELECT COUNT(*)::text AS cnt FROM orders`,
    );
    return Number(rows[0]?.cnt ?? 0);
  }

  async metricsByBusiness(): Promise<
    Array<{ id: string; slug: string; name: string; orderCount: string; gmv: string; lastOrderAt: Date | null }>
  > {
    return this.txHost.tx.query(
      `SELECT b.id,
              b.slug,
              b.name,
              COUNT(o.id)::text AS "orderCount",
              COALESCE(SUM(o.total) FILTER (WHERE o.status = 'done'), 0)::text AS gmv,
              MAX(o.created_at) AS "lastOrderAt"
       FROM businesses b
       LEFT JOIN orders o ON o.business_id = b.id
       WHERE b.deleted_at IS NULL
       GROUP BY b.id, b.slug, b.name
       ORDER BY COALESCE(SUM(o.total) FILTER (WHERE o.status = 'done'), 0) DESC`,
    );
  }

  findAllActive(): Promise<Business[]> {
    return this.repo.find({ where: { status: BusinessStatus.Active } });
  }

  /** Активные бизнесы с зашифрованным токеном бота (multi-bot registry). */
  findAllActiveWithBotToken(): Promise<Business[]> {
    return this.repo
      .createQueryBuilder('b')
      .addSelect('b.botTokenEnc')
      .where('b.status = :status', { status: BusinessStatus.Active })
      .andWhere('b.bot_token_enc IS NOT NULL')
      .getMany();
  }

  async updateBotStatus(id: string, status: BotStatus): Promise<void> {
    await this.repo.update(id, { botStatus: status });
  }

  async updateBotIdentity(
    id: string,
    patch: { botUsername?: string | null; botId?: string | null },
  ): Promise<void> {
    await this.repo.update(id, patch);
  }

  /** Единственный активный бизнес (переходный режим до мультибота, Phase 1–2). */
  findFirstActive(): Promise<Business | null> {
    return this.repo.findOne({ where: { status: BusinessStatus.Active }, order: { createdAt: 'ASC' } });
  }

  /** Бизнес с шифрованным токеном (select:false → только явный addSelect). */
  findByIdWithToken(id: string): Promise<Business | null> {
    return this.repo
      .createQueryBuilder('b')
      .addSelect('b.botTokenEnc')
      .where('b.id = :id', { id })
      .getOne();
  }

  /**
   * Выдать следующий номер заказа бизнеса. UPDATE … RETURNING под блокировкой
   * строки — без гонок; вызывается внутри транзакции создания заказа.
   */
  async allocateOrderNumber(businessId: string): Promise<number> {
    const rows: { last_order_no: number }[] = await this.txHost.tx.query(
      `UPDATE businesses SET last_order_no = last_order_no + 1, updated_at = now()
       WHERE id = $1 RETURNING last_order_no`,
      [businessId],
    );
    if (rows.length === 0) {
      throw new Error(`Бизнес ${businessId} не найден при выдаче номера заказа`);
    }
    return Number(rows[0].last_order_no);
  }

  save(business: Business): Promise<Business> {
    return this.repo.save(business);
  }
}
