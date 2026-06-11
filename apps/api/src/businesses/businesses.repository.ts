import { Injectable } from '@nestjs/common';
import { EntityTarget } from 'typeorm';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { BusinessStatus } from '@eatfit/shared';
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

  findAllActive(): Promise<Business[]> {
    return this.repo.find({ where: { status: BusinessStatus.Active } });
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
