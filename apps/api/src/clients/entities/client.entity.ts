import { Entity, Column, Check, Index } from 'typeorm';
import { Role, Language } from '@eatfit/shared';
import { BaseEntity } from '../../common/database/base.entity';
import { Money } from '../../common/money/money';
import { moneyTransformer } from '../../common/money/money.transformer';

@Entity('clients')
@Check(`"balance" >= 0`) // инвариант неотрицательности баланса (последний рубеж в БД)
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

  @Column({ type: 'varchar', nullable: true })
  address!: string | null;

  @Column({ type: 'enum', enum: Language, default: Language.Ru })
  language!: Language;

  @Column({ type: 'enum', enum: Role, default: Role.Client })
  role!: Role;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0, transformer: moneyTransformer })
  balance!: Money;
}
