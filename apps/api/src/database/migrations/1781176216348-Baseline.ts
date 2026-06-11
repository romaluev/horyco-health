import { MigrationInterface, QueryRunner } from "typeorm";

export class Baseline1781176216348 implements MigrationInterface {
    name = 'Baseline1781176216348'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // synchronize создавал расширение сам; миграции должны делать это явно.
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
        await queryRunner.query(`CREATE TYPE "public"."clients_language_enum" AS ENUM('ru', 'uz')`);
        await queryRunner.query(`CREATE TYPE "public"."clients_role_enum" AS ENUM('client', 'cook', 'courier', 'admin')`);
        await queryRunner.query(`CREATE TABLE "clients" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "telegram_id" bigint, "password_hash" character varying, "username" character varying, "name" character varying NOT NULL, "phone" character varying, "address" character varying, "language" "public"."clients_language_enum" NOT NULL DEFAULT 'ru', "role" "public"."clients_role_enum" NOT NULL DEFAULT 'client', "balance" numeric(12,2) NOT NULL DEFAULT '0', CONSTRAINT "CHK_05fe11605ba789332f9d3db0ec" CHECK ("balance" >= 0), CONSTRAINT "PK_f1ab7cf3a5714dbc6bb4e1c28a4" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_5e40ea575e0e969375b53a8bc0" ON "clients" ("telegram_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_a95860aa92d1420e005893043d" ON "clients" ("username") `);
        await queryRunner.query(`CREATE INDEX "IDX_aa22377d7d3e794ae4cd39cd9e" ON "clients" ("phone") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "uq_web_phone" ON "clients" ("phone") WHERE password_hash IS NOT NULL`);
        await queryRunner.query(`CREATE TYPE "public"."balance_transactions_type_enum" AS ENUM('deposit', 'order_charge', 'order_refund', 'admin_debit')`);
        await queryRunner.query(`CREATE TABLE "balance_transactions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "client_id" uuid NOT NULL, "type" "public"."balance_transactions_type_enum" NOT NULL, "amount" numeric(12,2) NOT NULL, "balance_after" numeric(12,2) NOT NULL, "order_id" uuid, "idempotency_key" character varying, CONSTRAINT "PK_6aea2d6b103d342d343be2ae93c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_e3545391199253fd16e91a393d" ON "balance_transactions" ("idempotency_key") WHERE "idempotency_key" IS NOT NULL`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_8cdf49df28daf429ca1b15f256" ON "balance_transactions" ("order_id", "type") WHERE "order_id" IS NOT NULL`);
        await queryRunner.query(`CREATE TYPE "public"."menu_items_category_enum" AS ENUM('main', 'drink', 'dessert')`);
        await queryRunner.query(`CREATE TABLE "menu_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "category" "public"."menu_items_category_enum" NOT NULL, "name_ru" character varying NOT NULL, "name_uz" character varying NOT NULL, "description_ru" text, "description_uz" text, "price" numeric(12,2) NOT NULL, "photo_file_id" character varying, "photo_url" character varying, "photo_data" bytea, "photo_mime" character varying, "weight_grams" integer, "price2" numeric(12,2), "weight_grams2" integer, "order_deadline" character varying(5), "ingredients" jsonb, "allergens" jsonb, "nutrition" jsonb, "nutrition2" jsonb, "is_active" boolean NOT NULL DEFAULT true, "days" integer array NOT NULL DEFAULT '{}', "deleted_at" TIMESTAMP, CONSTRAINT "PK_57e6188f929e5dc6919168620c8" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_9f677bef608826dcdf98e951f9" ON "menu_items" ("is_active", "category") `);
        await queryRunner.query(`CREATE TYPE "public"."orders_status_enum" AS ENUM('pending', 'confirmed', 'cooking', 'ready', 'delivering', 'done', 'cancelled')`);
        await queryRunner.query(`CREATE TYPE "public"."orders_payment_method_enum" AS ENUM('balance', 'on_delivery')`);
        await queryRunner.query(`CREATE TABLE "orders" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "order_number" SERIAL NOT NULL, "client_id" uuid NOT NULL, "status" "public"."orders_status_enum" NOT NULL DEFAULT 'pending', "total" numeric(12,2) NOT NULL, "address" character varying NOT NULL, "comment" text, "payment_method" "public"."orders_payment_method_enum" NOT NULL, "admin_msg_id" bigint, "cook_msg_id" bigint, "courier_msg_id" bigint, CONSTRAINT "PK_710e2d4957aa5878dfe94e4ac2f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_75eba1c6b1a66b09f2a97e6927" ON "orders" ("order_number") `);
        await queryRunner.query(`CREATE INDEX "IDX_2c0be44260a43104b5942d0446" ON "orders" ("client_id", "status") `);
        await queryRunner.query(`CREATE TABLE "order_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "order_id" uuid NOT NULL, "menu_item_id" uuid NOT NULL, "quantity" integer NOT NULL, "price_at_order" numeric(12,2) NOT NULL, "portion" integer NOT NULL DEFAULT '1', "portion_weight_grams" integer, "calories_at_order" integer, CONSTRAINT "CHK_6e5d794f7711186091b3156024" CHECK ("quantity" > 0), CONSTRAINT "PK_005269d8574e6fac0493715c308" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "deposits" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "client_id" uuid NOT NULL, "amount" numeric(12,2) NOT NULL, "admin_telegram_id" bigint NOT NULL, CONSTRAINT "CHK_055e8502a9f48d5f66ca86dbd8" CHECK ("amount" > 0), CONSTRAINT "PK_f49ba0cd446eaf7abb4953385d9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "app_settings" ("key" character varying NOT NULL, "value" text NOT NULL, "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_975c2db59c65c05fd9c6b63a2ab" PRIMARY KEY ("key"))`);
        await queryRunner.query(`ALTER TABLE "balance_transactions" ADD CONSTRAINT "FK_18d715a6c7d92e6dbe545c0952a" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "orders" ADD CONSTRAINT "FK_505ba3689ef2763acd6c4fc93a4" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "order_items" ADD CONSTRAINT "FK_145532db85752b29c57d2b7b1f1" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "order_items" ADD CONSTRAINT "FK_e462517174f561ece2916701c0a" FOREIGN KEY ("menu_item_id") REFERENCES "menu_items"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "deposits" ADD CONSTRAINT "FK_4c7095e1e21e583da7303924743" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "deposits" DROP CONSTRAINT "FK_4c7095e1e21e583da7303924743"`);
        await queryRunner.query(`ALTER TABLE "order_items" DROP CONSTRAINT "FK_e462517174f561ece2916701c0a"`);
        await queryRunner.query(`ALTER TABLE "order_items" DROP CONSTRAINT "FK_145532db85752b29c57d2b7b1f1"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP CONSTRAINT "FK_505ba3689ef2763acd6c4fc93a4"`);
        await queryRunner.query(`ALTER TABLE "balance_transactions" DROP CONSTRAINT "FK_18d715a6c7d92e6dbe545c0952a"`);
        await queryRunner.query(`DROP TABLE "app_settings"`);
        await queryRunner.query(`DROP TABLE "deposits"`);
        await queryRunner.query(`DROP TABLE "order_items"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_2c0be44260a43104b5942d0446"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_75eba1c6b1a66b09f2a97e6927"`);
        await queryRunner.query(`DROP TABLE "orders"`);
        await queryRunner.query(`DROP TYPE "public"."orders_payment_method_enum"`);
        await queryRunner.query(`DROP TYPE "public"."orders_status_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9f677bef608826dcdf98e951f9"`);
        await queryRunner.query(`DROP TABLE "menu_items"`);
        await queryRunner.query(`DROP TYPE "public"."menu_items_category_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8cdf49df28daf429ca1b15f256"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e3545391199253fd16e91a393d"`);
        await queryRunner.query(`DROP TABLE "balance_transactions"`);
        await queryRunner.query(`DROP TYPE "public"."balance_transactions_type_enum"`);
        await queryRunner.query(`DROP INDEX "public"."uq_web_phone"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_aa22377d7d3e794ae4cd39cd9e"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a95860aa92d1420e005893043d"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5e40ea575e0e969375b53a8bc0"`);
        await queryRunner.query(`DROP TABLE "clients"`);
        await queryRunner.query(`DROP TYPE "public"."clients_role_enum"`);
        await queryRunner.query(`DROP TYPE "public"."clients_language_enum"`);
    }

}
