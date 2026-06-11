import { Entity, Column, ManyToOne, JoinColumn, Check } from 'typeorm';
import { Allergens, Ingredient, Nutrition } from '@eatfit/shared';
import { BaseEntity } from '../../common/database/base.entity';
import { Money } from '../../common/money/money';
import { moneyTransformer } from '../../common/money/money.transformer';
import { Order } from './order.entity';
import { MenuItem } from '../../menu/entities/menu-item.entity';
import { Combo } from '../../combos/entities/combo.entity';
import { ModifierSnapshot, ComboSlotSnapshot } from '../pricing/line-pricing.types';

export type OrderItemKind = 'dish' | 'combo';

@Entity('order_items')
@Check(`"quantity" > 0`)
export class OrderItem extends BaseEntity {
  @ManyToOne(() => Order, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order!: Order;

  @Column({ type: 'uuid' })
  orderId!: string;

  @Column({ type: 'enum', enum: ['dish', 'combo'], default: 'dish' })
  kind!: OrderItemKind;

  @ManyToOne(() => MenuItem, { nullable: true })
  @JoinColumn({ name: 'menu_item_id' })
  menuItem!: MenuItem | null;

  @Column({ type: 'uuid', nullable: true })
  menuItemId!: string | null;

  @ManyToOne(() => Combo, { nullable: true })
  @JoinColumn({ name: 'combo_id' })
  combo!: Combo | null;

  @Column({ type: 'uuid', nullable: true })
  comboId!: string | null;

  @Column({ type: 'int' })
  quantity!: number;

  @Column({ type: 'numeric', precision: 12, scale: 2, transformer: moneyTransformer })
  priceAtOrder!: Money;

  @Column({ type: 'int', default: 1 })
  portion!: number;

  @Column({ type: 'int', nullable: true })
  portionWeightGrams!: number | null;

  @Column({ type: 'int', nullable: true })
  caloriesAtOrder!: number | null;

  @Column({ type: 'varchar' })
  nameRuSnapshot!: string;

  @Column({ type: 'varchar' })
  nameUzSnapshot!: string;

  @Column({ type: 'jsonb', nullable: true })
  nutritionSnapshot!: Nutrition | null;

  @Column({ type: 'jsonb', nullable: true })
  ingredientsSnapshot!: Ingredient[] | null;

  @Column({ type: 'jsonb', nullable: true })
  allergensSnapshot!: Allergens | null;

  @Column({ type: 'jsonb', nullable: true })
  modifiersSnapshot!: ModifierSnapshot[] | null;

  @Column({ type: 'jsonb', nullable: true })
  comboSelectionsSnapshot!: ComboSlotSnapshot[] | null;
}
