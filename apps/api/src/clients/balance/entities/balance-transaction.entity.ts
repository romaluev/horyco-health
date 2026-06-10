import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BalanceTransactionType } from '@eatfit/shared';
import { BaseEntity } from '../../../common/database/base.entity';
import { Money } from '../../../common/money/money';
import { moneyTransformer } from '../../../common/money/money.transformer';
import { Client } from '../../entities/client.entity';

/**
 * Append-only ledger движений по балансу. Баланс клиента — производная; инвариант
 * SUM(ledger) == balance. Уникальность (order_id, type) исключает двойной возврат/списание.
 */
@Entity('balance_transactions')
@Index(['orderId', 'type'], { unique: true, where: '"order_id" IS NOT NULL' })
export class BalanceTransaction extends BaseEntity {
  @ManyToOne(() => Client, { nullable: false })
  @JoinColumn({ name: 'client_id' })
  client!: Client;

  @Column({ type: 'uuid' })
  clientId!: string;

  @Column({ type: 'enum', enum: BalanceTransactionType })
  type!: BalanceTransactionType;

  // Знаковая сумма: + для пополнения/возврата, − для списания.
  @Column({ type: 'numeric', precision: 12, scale: 2, transformer: moneyTransformer })
  amount!: Money;

  // Снимок баланса после операции (для reconcile).
  @Column({ type: 'numeric', precision: 12, scale: 2, transformer: moneyTransformer })
  balanceAfter!: Money;

  @Column({ type: 'uuid', nullable: true })
  orderId!: string | null;

  // Ключ идемпотентности денежных команд (дедуп ретраев Telegram/дабл-тапов).
  @Index({ unique: true, where: '"idempotency_key" IS NOT NULL' })
  @Column({ type: 'varchar', nullable: true })
  idempotencyKey!: string | null;
}
