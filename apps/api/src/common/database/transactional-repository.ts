import { EntityTarget, ObjectLiteral, Repository } from 'typeorm';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';

/**
 * База репозитория, привязанная к активному транзакционному контексту (nestjs-cls).
 * `repo` всегда отдаёт Repository поверх текущего EntityManager — поэтому операции
 * внутри @Transactional() автоматически попадают в ту же транзакцию (FOR UPDATE и т.п.),
 * без проброса manager через сигнатуры.
 */
export abstract class TransactionalRepository<T extends ObjectLiteral> {
  protected abstract readonly entity: EntityTarget<T>;

  constructor(protected readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>) {}

  protected get repo(): Repository<T> {
    return this.txHost.tx.getRepository(this.entity);
  }
}
