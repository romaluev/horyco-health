import { Entity, Column, Index, DeleteDateColumn } from 'typeorm';
import { Category, Ingredient, Allergens, Nutrition } from '@eatfit/shared';
import { BaseEntity } from '../../common/database/base.entity';
import { Money } from '../../common/money/money';
import { moneyTransformer } from '../../common/money/money.transformer';

@Entity('menu_items')
@Index(['isActive', 'category']) // витрина активных блюд по категориям
export class MenuItem extends BaseEntity {
  @Column({ type: 'enum', enum: Category })
  category!: Category;

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

  // Фото: Telegram file_id (предпочтительно) или внешний URL; отдаётся через прокси-эндпоинт.
  @Column({ type: 'varchar', nullable: true })
  photoFileId!: string | null;

  @Column({ type: 'varchar', nullable: true })
  photoUrl!: string | null;

  // Загруженное из Mini App/сайта фото: бинарь в БД (ФС Railway эфемерна).
  // select:false — не тянуть бинарь в списочных запросах; грузим отдельно при отдаче.
  @Column({ type: 'bytea', nullable: true, select: false })
  photoData!: Buffer | null;

  // MIME загруженного фото; всегда в выборке → по нему определяем наличие фото без чтения бинаря.
  @Column({ type: 'varchar', nullable: true })
  photoMime!: string | null;

  // ── Подробные поля блюда (показываются в детальной карточке Mini App) ──
  // Вес/граммовка порции, граммы.
  @Column({ type: 'int', nullable: true })
  weightGrams!: number | null;

  // Вторая порция (вариант): своя цена и вес. Включена, когда задана price2.
  // Клиент выбирает порцию в Mini App; в заказ идёт цена выбранной порции.
  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true, transformer: moneyTransformer })
  price2!: Money | null;

  @Column({ type: 'int', nullable: true })
  weightGrams2!: number | null;

  // Дедлайн заказа в формате "HH:MM" (например "09:00") — до какого времени принимаем заказ.
  @Column({ type: 'varchar', length: 5, nullable: true })
  orderDeadline!: string | null;

  // Состав: список ингредиентов с граммовкой (двуязычные названия).
  @Column({ type: 'jsonb', nullable: true })
  ingredients!: Ingredient[] | null;

  // Аллергены: «содержит» / «может содержать» (свободный текст, двуязычно).
  @Column({ type: 'jsonb', nullable: true })
  allergens!: Allergens | null;

  // Пищевая ценность (КБЖУ) — для 1-й порции.
  @Column({ type: 'jsonb', nullable: true })
  nutrition!: Nutrition | null;

  // КБЖУ для 2-й порции (вес/цена и КБЖУ у порций разные; состав общий).
  @Column({ type: 'jsonb', nullable: true })
  nutrition2!: Nutrition | null;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  // Дни недели (ISO: 1=Пн … 7=Вс), когда блюдо показывается в витрине.
  // Строгий режим (см. menu.repository.findActive): напитки/десерты с пустым списком
  // показываются всегда, а ОСНОВНОЕ блюдо с пустым списком НЕ показывается ни в один день.
  @Column({ type: 'int', array: true, default: () => "'{}'" })
  days!: number[];

  // Мягкое удаление: блюдо нельзя удалять физически (на него ссылаются order_items по FK,
  // иначе нарушится история заказов). softDelete проставляет deleted_at; find/QueryBuilder
  // TypeORM автоматически исключают такие строки → блюдо пропадает из админки и витрины.
  @DeleteDateColumn()
  deletedAt!: Date | null;
}
