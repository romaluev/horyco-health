import { Entity, Column, ManyToOne, JoinColumn, Index, Check } from 'typeorm';
import { BusinessCustomerStatus } from '@eatfit/shared';
import { BaseEntity } from '../../common/database/base.entity';
import { Money } from '../../common/money/money';
import { moneyTransformer } from '../../common/money/money.transformer';
import { Business } from './business.entity';
import { Client } from '../../clients/entities/client.entity';

/**
 * Связь клиент↔бизнес: строка CRM и кошелёк. Профиль человека (имя/телефон/адрес/язык)
 * глобален на Client; здесь — только то, что принадлежит конкретному бизнесу:
 * баланс (предоплата хранится у бизнеса) и статистика заказов.
 */
@Entity('business_customers')
@Index('uq_business_customer', ['businessId', 'clientId'], { unique: true })
@Check(`"balance" >= 0`) // кошелёк не уходит в минус (последний рубеж в БД)
export class BusinessCustomer extends BaseEntity {
  @ManyToOne(() => Business, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'business_id' })
  business!: Business;

  @Column({ type: 'uuid' })
  businessId!: string;

  @ManyToOne(() => Client, { nullable: false })
  @JoinColumn({ name: 'client_id' })
  client!: Client;

  @Column({ type: 'uuid' })
  clientId!: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0, transformer: moneyTransformer })
  balance!: Money;

  @Column({ type: 'enum', enum: BusinessCustomerStatus, default: BusinessCustomerStatus.Active })
  status!: BusinessCustomerStatus;

  @Column({ type: 'int', default: 0 })
  ordersCount!: number;

  @Column({ type: 'timestamptz', nullable: true })
  firstOrderAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastOrderAt!: Date | null;
}
