import { MigrationInterface, QueryRunner } from 'typeorm';

/** Phase 6: CRM broadcast offers + recipients; orders.offer_id. */
export class AddOffers1781181000000 implements MigrationInterface {
  name = 'AddOffers1781181000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."offers_status_enum" AS ENUM('draft', 'sending', 'sent', 'cancelled')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."offer_recipients_status_enum" AS ENUM('pending', 'sent', 'opened', 'ordered', 'failed', 'skipped_no_telegram')`,
    );

    await queryRunner.query(`
      CREATE TABLE "offers" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "business_id" uuid NOT NULL,
        "status" "public"."offers_status_enum" NOT NULL DEFAULT 'draft',
        "composition" jsonb NOT NULL DEFAULT '[]',
        "description_ru" text,
        "description_uz" text,
        "estimated_total" numeric(12,2) NOT NULL DEFAULT '0',
        "created_by_id" uuid NOT NULL,
        "sent_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_offers" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_offers_business" ON "offers" ("business_id", "created_at")`);

    await queryRunner.query(`
      CREATE TABLE "offer_recipients" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "offer_id" uuid NOT NULL,
        "client_id" uuid NOT NULL,
        "status" "public"."offer_recipients_status_enum" NOT NULL DEFAULT 'pending',
        "telegram_message_id" bigint,
        "error_message" text,
        "order_id" uuid,
        "opened_at" TIMESTAMP WITH TIME ZONE,
        "ordered_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_offer_recipients" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_offer_recipient" ON "offer_recipients" ("offer_id", "client_id")`,
    );

    await queryRunner.query(`ALTER TABLE "orders" ADD "offer_id" uuid`);

    await queryRunner.query(`
      ALTER TABLE "offers" ADD CONSTRAINT "FK_offers_business"
        FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "offers" ADD CONSTRAINT "FK_offers_created_by"
        FOREIGN KEY ("created_by_id") REFERENCES "clients"("id")
    `);
    await queryRunner.query(`
      ALTER TABLE "offer_recipients" ADD CONSTRAINT "FK_offer_recipients_offer"
        FOREIGN KEY ("offer_id") REFERENCES "offers"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "offer_recipients" ADD CONSTRAINT "FK_offer_recipients_client"
        FOREIGN KEY ("client_id") REFERENCES "clients"("id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "offer_id"`);
    await queryRunner.query(`DROP TABLE "offer_recipients"`);
    await queryRunner.query(`DROP TABLE "offers"`);
    await queryRunner.query(`DROP TYPE "public"."offer_recipients_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."offers_status_enum"`);
  }
}
