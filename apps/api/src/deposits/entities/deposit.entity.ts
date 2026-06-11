import { Entity, Column, ManyToOne, JoinColumn, Check, Index } from 'typeorm';
import { BaseEntity } from '../../common/database/base.entity';
import { Money } from '../../common/money/money';
import { moneyTransformer } from '../../common/money/money.transformer';
import { Client } from '../../clients/entities/client.entity';
import { Business } from '../../businesses/entities/business.entity';

@Entity('deposits')
@Check(`"amount" > 0`) // пополнение строго положительное
@Index(['businessId', 'createdAt'])
export class Deposit extends BaseEntity {
  @ManyToOne(() => Business, { nullable: false })
  @JoinColumn({ name: 'business_id' })
  business!: Business;

  @Column({ type: 'uuid' })
  businessId!: string;

  @ManyToOne(() => Client, { nullable: false })
  @JoinColumn({ name: 'client_id' })
  client!: Client;

  @Column({ type: 'uuid' })
  clientId!: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, transformer: moneyTransformer })
  amount!: Money;

  // Telegram id админа, выполнившего пополнение (баланс пополняют только админы).
  @Column({ type: 'bigint' })
  adminTelegramId!: string;
}
