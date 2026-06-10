import { Entity, Column, ManyToOne, JoinColumn, Check } from 'typeorm';
import { BaseEntity } from '../../common/database/base.entity';
import { Money } from '../../common/money/money';
import { moneyTransformer } from '../../common/money/money.transformer';
import { Order } from './order.entity';
import { MenuItem } from '../../menu/entities/menu-item.entity';

@Entity('order_items')
@Check(`"quantity" > 0`) // запрет нулевого/отрицательного количества
export class OrderItem extends BaseEntity {
  @ManyToOne(() => Order, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order!: Order;

  @Column({ type: 'uuid' })
  orderId!: string;

  @ManyToOne(() => MenuItem, { nullable: false })
  @JoinColumn({ name: 'menu_item_id' })
  menuItem!: MenuItem;

  @Column({ type: 'uuid' })
  menuItemId!: string;

  @Column({ type: 'int' })
  quantity!: number;

  // Снимок цены на момент заказа (цены берутся из БД, не от клиента).
  @Column({ type: 'numeric', precision: 12, scale: 2, transformer: moneyTransformer })
  priceAtOrder!: Money;

  // Какая порция выбрана (1 — обычная, 2 — вторая порция со своей ценой).
  @Column({ type: 'int', default: 1 })
  portion!: number;

  // Снимок веса выбранной порции (для отображения; кухня видит размер порции).
  @Column({ type: 'int', nullable: true })
  portionWeightGrams!: number | null;

  // Снимок калорийности выбранной порции на момент заказа (ккал за 1 шт).
  // Для суммарной калорийности заказа; null, если у блюда КБЖУ не задан.
  @Column({ type: 'int', nullable: true })
  caloriesAtOrder!: number | null;
}
