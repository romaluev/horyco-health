import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../common/database/base.entity';
import { Money } from '../../common/money/money';
import { moneyTransformer } from '../../common/money/money.transformer';
import { Business } from '../../businesses/entities/business.entity';

export enum ModifierGroupKind {
  Modifier = 'modifier',
  Addition = 'addition',
}

export enum ModifierSelectionType {
  Single = 'SINGLE',
  Multiple = 'MULTIPLE',
}

export enum ModifierPricingType {
  Free = 'FREE',
  Paid = 'PAID',
  Included = 'INCLUDED',
}

@Entity('modifier_groups')
@Index(['businessId', 'isActive'])
export class ModifierGroup extends BaseEntity {
  @ManyToOne(() => Business, { nullable: false })
  @JoinColumn({ name: 'business_id' })
  business!: Business;

  @Column({ type: 'uuid' })
  businessId!: string;

  @Column({ type: 'varchar' })
  nameRu!: string;

  @Column({ type: 'varchar' })
  nameUz!: string;

  @Column({ type: 'enum', enum: ModifierGroupKind, default: ModifierGroupKind.Modifier })
  kind!: ModifierGroupKind;

  @Column({ type: 'enum', enum: ModifierSelectionType, default: ModifierSelectionType.Single })
  selectionType!: ModifierSelectionType;

  @Column({ type: 'enum', enum: ModifierPricingType, default: ModifierPricingType.Free })
  pricingType!: ModifierPricingType;

  @Column({ type: 'int', default: 0 })
  minSelect!: number;

  @Column({ type: 'int', nullable: true })
  maxSelect!: number | null;

  @Column({ type: 'boolean', default: false })
  isRequired!: boolean;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ type: 'int', default: 0 })
  sortOrder!: number;
}

@Entity('modifiers')
@Index(['groupId', 'isActive'])
export class Modifier extends BaseEntity {
  @ManyToOne(() => ModifierGroup, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'group_id' })
  group!: ModifierGroup;

  @Column({ type: 'uuid' })
  groupId!: string;

  @Column({ type: 'varchar' })
  nameRu!: string;

  @Column({ type: 'varchar' })
  nameUz!: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: '0', transformer: moneyTransformer })
  priceDelta!: Money;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ type: 'int', default: 0 })
  sortOrder!: number;
}

@Entity('menu_item_modifier_groups')
@Index(['menuItemId', 'groupId'], { unique: true })
export class MenuItemModifierGroup extends BaseEntity {
  @Column({ type: 'uuid' })
  menuItemId!: string;

  @Column({ type: 'uuid' })
  groupId!: string;

  @Column({ type: 'int', default: 0 })
  sortOrder!: number;
}
