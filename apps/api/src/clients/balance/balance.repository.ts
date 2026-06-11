import { Injectable } from '@nestjs/common';
import { EntityTarget } from 'typeorm';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { TransactionalRepository } from '../../common/database/transactional-repository';
import { BalanceTransaction } from './entities/balance-transaction.entity';

@Injectable()
export class BalanceRepository extends TransactionalRepository<BalanceTransaction> {
  protected readonly entity: EntityTarget<BalanceTransaction> = BalanceTransaction;

  constructor(txHost: TransactionHost<TransactionalAdapterTypeOrm>) {
    super(txHost);
  }

  create(data: Partial<BalanceTransaction>): Promise<BalanceTransaction> {
    return this.repo.save(this.repo.create(data));
  }

  findByClient(businessId: string, clientId: string): Promise<BalanceTransaction[]> {
    return this.repo.find({ where: { clientId, businessId }, order: { createdAt: 'DESC' } });
  }

  /** Проводка по ключу идемпотентности (scoped by business for tenant safety). */
  findByIdempotencyKey(businessId: string, key: string): Promise<BalanceTransaction | null> {
    return this.repo.findOne({ where: { idempotencyKey: key, businessId } });
  }
}
