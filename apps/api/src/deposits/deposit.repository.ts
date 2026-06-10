import { Injectable } from '@nestjs/common';
import { EntityTarget } from 'typeorm';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { TransactionalRepository } from '../common/database/transactional-repository';
import { Deposit } from './entities/deposit.entity';

@Injectable()
export class DepositRepository extends TransactionalRepository<Deposit> {
  protected readonly entity: EntityTarget<Deposit> = Deposit;

  constructor(txHost: TransactionHost<TransactionalAdapterTypeOrm>) {
    super(txHost);
  }

  create(data: Partial<Deposit>): Promise<Deposit> {
    return this.repo.save(this.repo.create(data));
  }

  findByClient(clientId: string): Promise<Deposit[]> {
    return this.repo.find({ where: { clientId }, order: { createdAt: 'DESC' } });
  }
}
