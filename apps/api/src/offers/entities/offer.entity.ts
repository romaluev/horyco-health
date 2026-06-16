import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../common/database/base.entity';
import { Money } from '../../common/money/money';
import { moneyTransformer } from '../../common/money/money.transformer';
import { Business } from '../../businesses/entities/business.entity';
import { Client } from '../../clients/entities/client.entity';
import { CartLineKind } from '../../orders/cart/cart-line.types';

export enum OfferStatus {
  Draft = 'draft',
  Sending = 'sending',
  Sent = 'sent',
  Cancelled = 'cancelled',
}

export enum OfferRecipientStatus {
  Pending = 'pending',
  Sent = 'sent',
  Opened = 'opened',
  Ordered = 'ordered',
  Expired = 'expired',
  Failed = 'failed',
  SkippedNoTelegram = 'skipped_no_telegram',
}

/** Строка composition оффера (mirrors CartLine without lineId). */
export interface OfferCompositionLine {
  kind: CartLineKind;
  menuItemId?: string;
  portion?: number;
  unitAmount?: number;
  comboId?: string;
  slotSelections?: Record<string, string>;
  modifierIds: string[];
  quantity: number;
}

@Entity('offers')
@Index(['businessId', 'createdAt'])
export class Offer extends BaseEntity {
  @ManyToOne(() => Business, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'business_id' })
  business!: Business;

  @Column({ type: 'uuid' })
  businessId!: string;

  @Column({ type: 'enum', enum: OfferStatus, default: OfferStatus.Draft })
  status!: OfferStatus;

  @Column({ type: 'jsonb', default: '[]' })
  composition!: OfferCompositionLine[];

  @Column({ type: 'text', nullable: true })
  descriptionRu!: string | null;

  @Column({ type: 'text', nullable: true })
  descriptionUz!: string | null;

  @Column({ type: 'numeric', precision: 12, scale: 2, transformer: moneyTransformer })
  estimatedTotal!: Money;

  @ManyToOne(() => Client, { nullable: false })
  @JoinColumn({ name: 'created_by_id' })
  createdBy!: Client;

  @Column({ type: 'uuid' })
  createdById!: string;

  @Column({ type: 'timestamptz', nullable: true })
  sentAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  expiresAt!: Date | null;
}

@Entity('offer_recipients')
@Index(['offerId'])
export class OfferRecipient extends BaseEntity {
  @ManyToOne(() => Offer, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'offer_id' })
  offer!: Offer;

  @Column({ type: 'uuid' })
  offerId!: string;

  @ManyToOne(() => Client, { nullable: false })
  @JoinColumn({ name: 'client_id' })
  client!: Client;

  @Column({ type: 'uuid' })
  clientId!: string;

  @Column({ type: 'enum', enum: OfferRecipientStatus, default: OfferRecipientStatus.Pending })
  status!: OfferRecipientStatus;

  @Column({ type: 'bigint', nullable: true })
  telegramMessageId!: string | null;

  @Column({ type: 'text', nullable: true })
  errorMessage!: string | null;

  @Column({ type: 'uuid', nullable: true })
  orderId!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  openedAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  orderedAt!: Date | null;
}
