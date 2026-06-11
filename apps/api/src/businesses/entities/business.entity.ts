import { Entity, Column, Index, DeleteDateColumn } from 'typeorm';
import { BusinessStatus, BotStatus, Language } from '@eatfit/shared';
import { BaseEntity } from '../../common/database/base.entity';

/**
 * Бизнес (тенант): тёмная кухня со своим ботом, меню, клиентами и группами.
 * Токен бота хранится только шифрованным (AES-256-GCM, TOKEN_ENC_KEY) и никогда
 * не сериализуется в DTO; bot_id (числовой префикс токена) обеспечивает
 * уникальность «один бот — один бизнес» без расшифровки.
 */
@Entity('businesses')
export class Business extends BaseEntity {
  // URL-safe идентификатор для Mini App (?biz=<slug>). Неизменяем после создания.
  @Index({ unique: true })
  @Column({ type: 'varchar' })
  slug!: string;

  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'enum', enum: BusinessStatus, default: BusinessStatus.Onboarding })
  status!: BusinessStatus;

  // Шифрованный токен бота (iv:tag:ciphertext, base64). select:false — только явная выборка.
  @Column({ type: 'text', nullable: true, select: false })
  botTokenEnc!: string | null;

  // Числовой префикс токена. Уникален среди бизнесов — один бот не может обслуживать двоих.
  @Index({ unique: true, where: 'bot_id IS NOT NULL' })
  @Column({ type: 'bigint', nullable: true })
  botId!: string | null;

  @Column({ type: 'varchar', nullable: true })
  botUsername!: string | null;

  @Column({ type: 'enum', enum: BotStatus, default: BotStatus.Off })
  botStatus!: BotStatus;

  // Секрет вебхука этого бота (X-Telegram-Bot-Api-Secret-Token).
  @Column({ type: 'varchar', nullable: true })
  webhookSecret!: string | null;

  @Column({ type: 'enum', enum: Language, default: Language.Ru })
  languageDefault!: Language;

  @Column({ type: 'int', default: 5 })
  tzOffsetHours!: number;

  @Column({ type: 'int', default: 19 })
  dailyReportHour!: number;

  // Контакты (бывшие app_settings: support_contact / topup_telegram / topup_phone).
  @Column({ type: 'varchar', nullable: true })
  supportContact!: string | null;

  @Column({ type: 'varchar', nullable: true })
  topupTelegram!: string | null;

  @Column({ type: 'varchar', nullable: true })
  topupPhone!: string | null;

  // Счётчик заказов бизнеса: номер выдаётся UPDATE … RETURNING под блокировкой строки.
  @Column({ type: 'int', default: 0 })
  lastOrderNo!: number;

  @DeleteDateColumn()
  deletedAt!: Date | null;
}
