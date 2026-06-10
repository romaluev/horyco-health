import { Entity, Column, ManyToOne, JoinColumn, Index, Generated } from 'typeorm';
import { OrderStatus, PaymentMethod } from '@eatfit/shared';
import { BaseEntity } from '../../common/database/base.entity';
import { Money } from '../../common/money/money';
import { moneyTransformer } from '../../common/money/money.transformer';
import { Client } from '../../clients/entities/client.entity';

@Entity('orders')
@Index(['clientId', 'status'])
export class Order extends BaseEntity {
  // Короткий последовательный номер заказа (для человека — удобно писать/диктовать).
  // id остаётся uuid (анти-IDOR), а в UI/уведомлениях показываем orderNumber.
  @Index({ unique: true })
  @Generated('increment')
  @Column({ type: 'int' })
  orderNumber!: number;

  @ManyToOne(() => Client, { nullable: false })
  @JoinColumn({ name: 'client_id' })
  client!: Client;

  @Column({ type: 'uuid' })
  clientId!: string;

  @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.Pending })
  status!: OrderStatus;

  @Column({ type: 'numeric', precision: 12, scale: 2, transformer: moneyTransformer })
  total!: Money;

  @Column({ type: 'varchar' })
  address!: string;

  @Column({ type: 'text', nullable: true })
  comment!: string | null;

  @Column({ type: 'enum', enum: PaymentMethod })
  paymentMethod!: PaymentMethod;

  // id сообщения админ-карточки заказа для live-обновления (FR-O5).
  @Column({ type: 'bigint', nullable: true })
  adminMsgId!: string | null;
}
