import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../common/database/base.entity';
import { Money } from '../../common/money/money';
import { moneyTransformer } from '../../common/money/money.transformer';
import { Business } from '../../businesses/entities/business.entity';
import { MenuItem } from '../../menu/entities/menu-item.entity';

@Entity('combos')
@Index(['businessId', 'isActive'])
export class Combo extends BaseEntity {
  @ManyToOne(() => Business, { nullable: false })
  @JoinColumn({ name: 'business_id' })
  business!: Business;

  @Column({ type: 'uuid' })
  businessId!: string;

  @Column({ type: 'varchar' })
  nameRu!: string;

  @Column({ type: 'varchar' })
  nameUz!: string;

  @Column({ type: 'text', nullable: true })
  descriptionRu!: string | null;

  @Column({ type: 'text', nullable: true })
  descriptionUz!: string | null;

  @Column({ type: 'numeric', precision: 12, scale: 2, transformer: moneyTransformer })
  price!: Money;

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true, transformer: moneyTransformer })
  originalPrice!: Money | null;

  @Column({ type: 'varchar', nullable: true })
  photoFileId!: string | null;

  @Column({ type: 'varchar', nullable: true })
  photoUrl!: string | null;

  @Column({ type: 'varchar', length: 5, nullable: true })
  orderDeadline!: string | null;

  @Column({ type: 'int', array: true, default: () => "'{}'" })
  days!: number[];

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;
}

@Entity('combo_slots')
@Index(['comboId'])
export class ComboSlot extends BaseEntity {
  @ManyToOne(() => Combo, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'combo_id' })
  combo!: Combo;

  @Column({ type: 'uuid' })
  comboId!: string;

  @Column({ type: 'varchar' })
  nameRu!: string;

  @Column({ type: 'varchar' })
  nameUz!: string;

  @Column({ type: 'int', default: 0 })
  sortOrder!: number;
}

@Entity('combo_slot_options')
@Index(['slotId'])
export class ComboSlotOption extends BaseEntity {
  @ManyToOne(() => ComboSlot, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'slot_id' })
  slot!: ComboSlot;

  @Column({ type: 'uuid' })
  slotId!: string;

  @ManyToOne(() => MenuItem, { nullable: false })
  @JoinColumn({ name: 'menu_item_id' })
  menuItem!: MenuItem;

  @Column({ type: 'uuid' })
  menuItemId!: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: '0', transformer: moneyTransformer })
  priceOverride!: Money;

  @Column({ type: 'boolean', default: false })
  isDefault!: boolean;

  @Column({ type: 'int', default: 0 })
  sortOrder!: number;
}

@Entity('combo_modifier_groups')
@Index(['comboId', 'groupId'], { unique: true })
export class ComboModifierGroup extends BaseEntity {
  @Column({ type: 'uuid' })
  comboId!: string;

  @Column({ type: 'uuid' })
  groupId!: string;

  @Column({ type: 'int', default: 0 })
  sortOrder!: number;
}

export interface ComboWithDetails extends Combo {
  slots: Array<
    ComboSlot & {
      options: Array<ComboSlotOption & { menuItem?: MenuItem }>;
    }
  >;
}
