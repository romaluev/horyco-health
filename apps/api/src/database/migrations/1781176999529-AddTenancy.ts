import { MigrationInterface, QueryRunner } from 'typeorm';
import { encryptToken, parseEncKey, botIdFromToken } from '../../businesses/token-crypto';

/**
 * Тенантность: businesses/business_members/business_customers/business_chats,
 * business_id на доменных таблицах, пер-бизнесовые номера заказов, app_settings →
 * колонки businesses. Содержит бэкфилл «Бизнеса #1» из текущего окружения
 * (BOT_TOKEN/группы/настройки) — живые dev/prod данные становятся его данными.
 *
 * Порядок важен: новые колонки добавляются NULL → сид бизнеса → бэкфилл → NOT NULL.
 * Обратима (down восстанавливает app_settings и sequence номеров заказов).
 */
export class AddTenancy1781176999529 implements MigrationInterface {
  name = 'AddTenancy1781176999529';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── 1. Новые типы и таблицы (DDL сгенерирован TypeORM, имена индексов — его) ──
    await queryRunner.query(`CREATE TYPE "public"."businesses_status_enum" AS ENUM('onboarding', 'active', 'suspended')`);
    await queryRunner.query(`CREATE TYPE "public"."businesses_bot_status_enum" AS ENUM('off', 'webhook', 'polling', 'error', 'revoked')`);
    await queryRunner.query(`CREATE TYPE "public"."businesses_language_default_enum" AS ENUM('ru', 'uz')`);
    await queryRunner.query(`CREATE TABLE "businesses" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "slug" character varying NOT NULL, "name" character varying NOT NULL, "status" "public"."businesses_status_enum" NOT NULL DEFAULT 'onboarding', "bot_token_enc" text, "bot_id" bigint, "bot_username" character varying, "bot_status" "public"."businesses_bot_status_enum" NOT NULL DEFAULT 'off', "webhook_secret" character varying, "language_default" "public"."businesses_language_default_enum" NOT NULL DEFAULT 'ru', "tz_offset_hours" integer NOT NULL DEFAULT '5', "daily_report_hour" integer NOT NULL DEFAULT '19', "support_contact" character varying, "topup_telegram" character varying, "topup_phone" character varying, "last_order_no" integer NOT NULL DEFAULT '0', "deleted_at" TIMESTAMP, CONSTRAINT "PK_bc1bf63498dd2368ce3dc8686e8" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_82ca19bc20713fdfa72626a5da" ON "businesses" ("slug") `);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_1a9e1b352a21756c46cce38713" ON "businesses" ("bot_id") WHERE bot_id IS NOT NULL`);
    await queryRunner.query(`CREATE TYPE "public"."business_members_role_enum" AS ENUM('owner', 'manager', 'cook', 'courier')`);
    await queryRunner.query(`CREATE TYPE "public"."business_members_status_enum" AS ENUM('invited', 'active', 'removed')`);
    await queryRunner.query(`CREATE TABLE "business_members" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "business_id" uuid NOT NULL, "client_id" uuid NOT NULL, "role" "public"."business_members_role_enum" NOT NULL, "status" "public"."business_members_status_enum" NOT NULL DEFAULT 'invited', "invite_token" character varying, "invited_by_id" uuid, CONSTRAINT "PK_0665f675783d42efe8fb5e5697c" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_85a83e762f3b8f3465059cc041" ON "business_members" ("invite_token") WHERE invite_token IS NOT NULL`);
    await queryRunner.query(`CREATE UNIQUE INDEX "uq_business_member" ON "business_members" ("business_id", "client_id") `);
    await queryRunner.query(`CREATE TYPE "public"."business_customers_status_enum" AS ENUM('active', 'blocked')`);
    await queryRunner.query(`CREATE TABLE "business_customers" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "business_id" uuid NOT NULL, "client_id" uuid NOT NULL, "balance" numeric(12,2) NOT NULL DEFAULT '0', "status" "public"."business_customers_status_enum" NOT NULL DEFAULT 'active', "orders_count" integer NOT NULL DEFAULT '0', "first_order_at" TIMESTAMP WITH TIME ZONE, "last_order_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "CHK_34f4e709f83fd8142f599a1019" CHECK ("balance" >= 0), CONSTRAINT "PK_00f259de4845e644ba833fd6171" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE UNIQUE INDEX "uq_business_customer" ON "business_customers" ("business_id", "client_id") `);
    await queryRunner.query(`CREATE TYPE "public"."business_chats_kind_enum" AS ENUM('cook', 'courier', 'admin', 'channel')`);
    await queryRunner.query(`CREATE TYPE "public"."business_chats_status_enum" AS ENUM('active', 'broken')`);
    await queryRunner.query(`CREATE TABLE "business_chats" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "business_id" uuid NOT NULL, "kind" "public"."business_chats_kind_enum" NOT NULL, "chat_id" character varying NOT NULL, "title" character varying, "status" "public"."business_chats_status_enum" NOT NULL DEFAULT 'active', CONSTRAINT "PK_914f112d6316872e77727a64377" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE UNIQUE INDEX "uq_business_chat_kind" ON "business_chats" ("business_id", "kind") `);

    // ── 2. Колонки на существующих таблицах: сперва NULL (живые данные!) ──
    await queryRunner.query(`ALTER TABLE "clients" ADD "is_platform_admin" boolean NOT NULL DEFAULT false`);
    await queryRunner.query(`ALTER TABLE "balance_transactions" ADD "business_id" uuid`);
    await queryRunner.query(`ALTER TABLE "menu_items" ADD "business_id" uuid`);
    await queryRunner.query(`ALTER TABLE "orders" ADD "business_id" uuid`);
    await queryRunner.query(`ALTER TABLE "deposits" ADD "business_id" uuid`);

    // Номера заказов: больше не sequence — счётчик в businesses.last_order_no.
    await queryRunner.query(`DROP INDEX "public"."IDX_75eba1c6b1a66b09f2a97e6927"`);
    await queryRunner.query(`ALTER TABLE "orders" ALTER COLUMN "order_number" DROP DEFAULT`);
    await queryRunner.query(`DROP SEQUENCE "orders_order_number_seq"`);

    // ── 3. Сид Бизнеса #1 из окружения (dev/prod Coolify; на пустой БД — onboarding) ──
    const botToken = process.env.BOT_TOKEN?.trim() || null;
    const botUsername = process.env.BOT_USERNAME?.trim() || null;
    const tz = parseInt(process.env.TZ_OFFSET_HOURS ?? '5', 10);
    const reportHour = parseInt(process.env.DAILY_REPORT_HOUR ?? '19', 10);
    let botTokenEnc: string | null = null;
    let botId: string | null = null;
    if (botToken) {
      botTokenEnc = encryptToken(botToken, parseEncKey(process.env.TOKEN_ENC_KEY));
      botId = botIdFromToken(botToken);
    }
    const status = botToken ? 'active' : 'onboarding';
    const [{ id: bizId }]: { id: string }[] = await queryRunner.query(
      `INSERT INTO businesses (slug, name, status, bot_token_enc, bot_id, bot_username, tz_offset_hours, daily_report_hour)
       VALUES ('eatfit', 'Eat&fit', $1, $2, $3, $4, $5, $6) RETURNING id`,
      [status, botTokenEnc, botId, botUsername, tz, reportHour],
    );

    // Контакты из app_settings → колонки бизнеса.
    await queryRunner.query(
      `UPDATE businesses SET
         topup_telegram  = (SELECT value FROM app_settings WHERE key = 'topup_telegram'),
         topup_phone     = (SELECT value FROM app_settings WHERE key = 'topup_phone'),
         support_contact = (SELECT value FROM app_settings WHERE key = 'support_contact')
       WHERE id = $1`,
      [bizId],
    );

    // Привязки чатов из env (числовые id и @username каналов — chat_id это varchar).
    const chatEnv: Array<[string, string | undefined]> = [
      ['cook', process.env.COOK_GROUP_ID],
      ['courier', process.env.COURIER_GROUP_ID],
      ['admin', process.env.ADMIN_GROUP_ID],
      ['channel', process.env.CHANNEL_ID],
    ];
    for (const [kind, chatId] of chatEnv) {
      if (chatId?.trim()) {
        await queryRunner.query(
          `INSERT INTO business_chats (business_id, kind, chat_id) VALUES ($1, $2, $3)`,
          [bizId, kind, chatId.trim()],
        );
      }
    }

    // ── 4. Бэкфилл доменных таблиц → NOT NULL ──
    for (const table of ['menu_items', 'orders', 'deposits', 'balance_transactions']) {
      await queryRunner.query(`UPDATE "${table}" SET business_id = $1 WHERE business_id IS NULL`, [bizId]);
      await queryRunner.query(`ALTER TABLE "${table}" ALTER COLUMN "business_id" SET NOT NULL`);
    }
    await queryRunner.query(
      `UPDATE businesses SET last_order_no = (SELECT COALESCE(MAX(order_number), 0) FROM orders) WHERE id = $1`,
      [bizId],
    );

    // ── 5. CRM-строки: каждый существующий клиент — клиент Бизнеса #1 (баланс переедет в Phase 2) ──
    await queryRunner.query(
      `INSERT INTO business_customers (business_id, client_id)
       SELECT $1, id FROM clients ON CONFLICT DO NOTHING`,
      [bizId],
    );

    // ── 6. Членства из legacy-ролей: первый админ → owner, остальные → manager; повара/курьеры — как есть ──
    await queryRunner.query(
      `INSERT INTO business_members (business_id, client_id, role, status)
       SELECT $1, c.id,
         CASE
           WHEN c.role = 'admin' AND c.id = (SELECT id FROM clients WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1) THEN 'owner'::business_members_role_enum
           WHEN c.role = 'admin' THEN 'manager'::business_members_role_enum
           WHEN c.role = 'cook' THEN 'cook'::business_members_role_enum
           ELSE 'courier'::business_members_role_enum
         END,
         'active'
       FROM clients c WHERE c.role IN ('admin', 'cook', 'courier')
       ON CONFLICT DO NOTHING`,
      [bizId],
    );

    // ADMIN_TELEGRAM_IDS: сид платформенных админов (основатель) + членство manager, если его ещё нет.
    const adminIds = (process.env.ADMIN_TELEGRAM_IDS ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (adminIds.length > 0) {
      await queryRunner.query(
        `UPDATE clients SET is_platform_admin = true WHERE telegram_id::text = ANY($1)`,
        [adminIds],
      );
      await queryRunner.query(
        `INSERT INTO business_members (business_id, client_id, role, status)
         SELECT $1, c.id, 'manager', 'active' FROM clients c
         WHERE c.telegram_id::text = ANY($2)
         ON CONFLICT (business_id, client_id) DO NOTHING`,
        [bizId, adminIds],
      );
    }

    // ── 7. app_settings скопированы выше — таблица больше не нужна ──
    await queryRunner.query(`DROP TABLE "app_settings"`);

    // ── 8. Индексы и FK (DDL сгенерирован TypeORM) ──
    await queryRunner.query(`DROP INDEX "public"."IDX_9f677bef608826dcdf98e951f9"`);
    await queryRunner.query(`CREATE INDEX "IDX_2d19b77b5f90a7289e1ba571a6" ON "balance_transactions" ("business_id", "created_at") `);
    await queryRunner.query(`CREATE INDEX "IDX_89b91a288876b305c65155a0a7" ON "menu_items" ("business_id", "is_active", "category") `);
    await queryRunner.query(`CREATE UNIQUE INDEX "uq_order_number_per_business" ON "orders" ("business_id", "order_number") `);
    await queryRunner.query(`CREATE INDEX "IDX_f17e5e8e4b88d4f2dcf3d75b88" ON "orders" ("business_id", "created_at") `);
    await queryRunner.query(`CREATE INDEX "IDX_c680815eee35a8cf16ea7220e5" ON "orders" ("business_id", "status") `);
    await queryRunner.query(`CREATE INDEX "IDX_3f0da769a2a993db94077b2c5d" ON "deposits" ("business_id", "created_at") `);
    await queryRunner.query(`ALTER TABLE "balance_transactions" ADD CONSTRAINT "FK_7b4c9760fe775ccb2507aaf2df0" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "menu_items" ADD CONSTRAINT "FK_67f742a13f58ca39ab9faca89fd" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "orders" ADD CONSTRAINT "FK_0e78f67403faf37092dce90d73a" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "deposits" ADD CONSTRAINT "FK_4a31e0a532867e5653910b9b7e1" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "business_members" ADD CONSTRAINT "FK_123f737f36b33e71fe0b3028fdc" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "business_members" ADD CONSTRAINT "FK_41e4336a29f3ea893a7623a1e4c" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "business_customers" ADD CONSTRAINT "FK_2189a241d1533a1d99cfa88fc7c" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "business_customers" ADD CONSTRAINT "FK_3a71a29993b64abc86344b527d3" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "business_chats" ADD CONSTRAINT "FK_bc712ae7b69ff9f9192c76ef7c6" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Восстановить app_settings из колонок бизнеса (как в Baseline).
    await queryRunner.query(`CREATE TABLE "app_settings" ("key" character varying NOT NULL, "value" text NOT NULL, "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_975c2db59c65c05fd9c6b63a2ab" PRIMARY KEY ("key"))`);
    await queryRunner.query(
      `INSERT INTO app_settings (key, value)
       SELECT k, v FROM businesses b CROSS JOIN LATERAL (VALUES
         ('topup_telegram', b.topup_telegram),
         ('topup_phone', b.topup_phone),
         ('support_contact', b.support_contact)
       ) AS s(k, v)
       WHERE b.slug = 'eatfit' AND v IS NOT NULL`,
    );

    await queryRunner.query(`ALTER TABLE "business_chats" DROP CONSTRAINT "FK_bc712ae7b69ff9f9192c76ef7c6"`);
    await queryRunner.query(`ALTER TABLE "business_customers" DROP CONSTRAINT "FK_3a71a29993b64abc86344b527d3"`);
    await queryRunner.query(`ALTER TABLE "business_customers" DROP CONSTRAINT "FK_2189a241d1533a1d99cfa88fc7c"`);
    await queryRunner.query(`ALTER TABLE "business_members" DROP CONSTRAINT "FK_41e4336a29f3ea893a7623a1e4c"`);
    await queryRunner.query(`ALTER TABLE "business_members" DROP CONSTRAINT "FK_123f737f36b33e71fe0b3028fdc"`);
    await queryRunner.query(`ALTER TABLE "deposits" DROP CONSTRAINT "FK_4a31e0a532867e5653910b9b7e1"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP CONSTRAINT "FK_0e78f67403faf37092dce90d73a"`);
    await queryRunner.query(`ALTER TABLE "menu_items" DROP CONSTRAINT "FK_67f742a13f58ca39ab9faca89fd"`);
    await queryRunner.query(`ALTER TABLE "balance_transactions" DROP CONSTRAINT "FK_7b4c9760fe775ccb2507aaf2df0"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_3f0da769a2a993db94077b2c5d"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_c680815eee35a8cf16ea7220e5"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_f17e5e8e4b88d4f2dcf3d75b88"`);
    await queryRunner.query(`DROP INDEX "public"."uq_order_number_per_business"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_89b91a288876b305c65155a0a7"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_2d19b77b5f90a7289e1ba571a6"`);

    // Вернуть sequence номеров заказов и продолжить с максимума.
    await queryRunner.query(`CREATE SEQUENCE IF NOT EXISTS "orders_order_number_seq" OWNED BY "orders"."order_number"`);
    await queryRunner.query(`ALTER TABLE "orders" ALTER COLUMN "order_number" SET DEFAULT nextval('"orders_order_number_seq"')`);
    await queryRunner.query(`SELECT setval('"orders_order_number_seq"', (SELECT COALESCE(MAX(order_number), 0) + 1 FROM orders), false)`);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_75eba1c6b1a66b09f2a97e6927" ON "orders" ("order_number") `);

    await queryRunner.query(`ALTER TABLE "deposits" DROP COLUMN "business_id"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "business_id"`);
    await queryRunner.query(`ALTER TABLE "menu_items" DROP COLUMN "business_id"`);
    await queryRunner.query(`ALTER TABLE "balance_transactions" DROP COLUMN "business_id"`);
    await queryRunner.query(`ALTER TABLE "clients" DROP COLUMN "is_platform_admin"`);
    await queryRunner.query(`DROP INDEX "public"."uq_business_chat_kind"`);
    await queryRunner.query(`DROP TABLE "business_chats"`);
    await queryRunner.query(`DROP TYPE "public"."business_chats_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."business_chats_kind_enum"`);
    await queryRunner.query(`DROP INDEX "public"."uq_business_customer"`);
    await queryRunner.query(`DROP TABLE "business_customers"`);
    await queryRunner.query(`DROP TYPE "public"."business_customers_status_enum"`);
    await queryRunner.query(`DROP INDEX "public"."uq_business_member"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_85a83e762f3b8f3465059cc041"`);
    await queryRunner.query(`DROP TABLE "business_members"`);
    await queryRunner.query(`DROP TYPE "public"."business_members_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."business_members_role_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_1a9e1b352a21756c46cce38713"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_82ca19bc20713fdfa72626a5da"`);
    await queryRunner.query(`DROP TABLE "businesses"`);
    await queryRunner.query(`DROP TYPE "public"."businesses_language_default_enum"`);
    await queryRunner.query(`DROP TYPE "public"."businesses_bot_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."businesses_status_enum"`);
    await queryRunner.query(`CREATE INDEX "IDX_9f677bef608826dcdf98e951f9" ON "menu_items" ("category", "is_active") `);
  }
}
