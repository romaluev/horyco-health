import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { OrderStatus, PaymentMethod } from '@eatfit/shared';
import { BaseEntity } from '../../common/database/base.entity';
import { Money } from '../../common/money/money';
import { moneyTransformer } from '../../common/money/money.transformer';
import { Client } from '../../clients/entities/client.entity';
import { Business } from '../../businesses/entities/business.entity';

@Entity('orders')
@Index(['clientId', 'status'])
@Index(['businessId', 'status'])
@Index(['businessId', 'createdAt'])
// Номер уникален в пределах бизнеса (счётчик businesses.last_order_no, без sequence).
@Index('uq_order_number_per_business', ['businessId', 'orderNumber'], { unique: true })
export class Order extends BaseEntity {
  @ManyToOne(() => Business, { nullable: false })
  @JoinColumn({ name: 'business_id' })
  business!: Business;

  @Column({ type: 'uuid' })
  businessId!: string;

  // Короткий последовательный номер заказа (для человека — удобно писать/диктовать).
  // id остаётся uuid (анти-IDOR), а в UI/уведомлениях показываем orderNumber.
  // Выдаётся в транзакции через BusinessesRepository.allocateOrderNumber.
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

  // id сообщений карточек заказа в группах для live-обновления (FR-O5).
  @Column({ type: 'bigint', nullable: true })
  adminMsgId!: string | null;

  @Column({ type: 'bigint', nullable: true })
  cookMsgId!: string | null;

  @Column({ type: 'bigint', nullable: true })
  courierMsgId!: string | null;
}
