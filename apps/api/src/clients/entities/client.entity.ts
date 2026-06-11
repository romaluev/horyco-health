import { Entity, Column, Index } from 'typeorm';
import { Role, Language } from '@eatfit/shared';
import { BaseEntity } from '../../common/database/base.entity';

@Entity('clients')
// Телефон уникален среди веб-аккаунтов (password_hash IS NOT NULL); Telegram-клиенты не мешают.
@Index('uq_web_phone', ['phone'], { unique: true, where: 'password_hash IS NOT NULL' })
export class Client extends BaseEntity {
  // У Telegram-клиента — telegram id (уникален); у веб-аккаунта (регистрация на сайте) — null.
  @Index({ unique: true })
  @Column({ type: 'bigint', nullable: true })
  telegramId!: string | null;

  // Хеш пароля для веб-аккаунтов (scrypt). У Telegram-клиентов — null (вход по initData).
  @Column({ type: 'varchar', nullable: true })
  passwordHash!: string | null;

  @Index()
  @Column({ type: 'varchar', nullable: true })
  username!: string | null;

  @Column({ type: 'varchar' })
  name!: string;

  @Index()
  @Column({ type: 'varchar', nullable: true })
  phone!: string | null;

  /** Ориентир: подъезд, квартира, комментарий к точке на карте. */
  @Column({ type: 'varchar', nullable: true })
  address!: string | null;

  /** Широта точки доставки (Telegram location / browser geolocation). */
  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  deliveryLat!: string | null;

  /** Долгота точки доставки. */
  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  deliveryLng!: string | null;

  @Column({ type: 'enum', enum: Language, default: Language.Ru })
  language!: Language;

  // LEGACY: права внутри бизнеса определяет членство (business_members);
  // колонка остаётся для переходного периода и исторических данных.
  // Баланс живёт в business_customers (кошелёк per-бизнес), НЕ здесь.
  @Column({ type: 'enum', enum: Role, default: Role.Client })
  role!: Role;

  // Платформенный админ (основатель): доступ к /api/platform/*, сид через ADMIN_TELEGRAM_IDS.
  @Column({ type: 'boolean', default: false })
  isPlatformAdmin!: boolean;
}
