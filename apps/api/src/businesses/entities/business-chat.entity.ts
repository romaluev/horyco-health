import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { ChatKind, ChatStatus } from '@eatfit/shared';
import { BaseEntity } from '../../common/database/base.entity';
import { Business } from './business.entity';

/**
 * Привязка чата/канала бизнеса (повара/курьеры/админы/канал). У привязки есть
 * жизненный цикл: active → broken (бота выгнали) → перепривязка. chat_id — varchar:
 * хранит и числовой id ('-100…'), и @username канала; арифметики по нему нет.
 */
@Entity('business_chats')
@Index('uq_business_chat_kind', ['businessId', 'kind'], { unique: true })
export class BusinessChat extends BaseEntity {
  @ManyToOne(() => Business, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'business_id' })
  business!: Business;

  @Column({ type: 'uuid' })
  businessId!: string;

  @Column({ type: 'enum', enum: ChatKind })
  kind!: ChatKind;

  @Column({ type: 'varchar' })
  chatId!: string;

  @Column({ type: 'varchar', nullable: true })
  title!: string | null;

  @Column({ type: 'enum', enum: ChatStatus, default: ChatStatus.Active })
  status!: ChatStatus;
}
