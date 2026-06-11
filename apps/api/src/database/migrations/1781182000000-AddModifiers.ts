import { MigrationInterface, QueryRunner } from 'typeorm';

/** Phase 7: modifier groups, modifiers, menu_item_modifier_groups. */
export class AddModifiers1781182000000 implements MigrationInterface {
  name = 'AddModifiers1781182000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."modifier_groups_kind_enum" AS ENUM('modifier', 'addition')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."modifier_groups_selection_type_enum" AS ENUM('SINGLE', 'MULTIPLE')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."modifier_groups_pricing_type_enum" AS ENUM('FREE', 'PAID', 'INCLUDED')`,
    );

    await queryRunner.query(`
      CREATE TABLE "modifier_groups" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "business_id" uuid NOT NULL,
        "name_ru" character varying NOT NULL,
        "name_uz" character varying NOT NULL,
        "kind" "public"."modifier_groups_kind_enum" NOT NULL DEFAULT 'modifier',
        "selection_type" "public"."modifier_groups_selection_type_enum" NOT NULL DEFAULT 'SINGLE',
        "pricing_type" "public"."modifier_groups_pricing_type_enum" NOT NULL DEFAULT 'FREE',
        "min_select" integer NOT NULL DEFAULT 0,
        "max_select" integer,
        "is_required" boolean NOT NULL DEFAULT false,
        "is_active" boolean NOT NULL DEFAULT true,
        "sort_order" integer NOT NULL DEFAULT 0,
        CONSTRAINT "PK_modifier_groups" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_modifier_groups_business" ON "modifier_groups" ("business_id", "is_active")`,
    );

    await queryRunner.query(`
      CREATE TABLE "modifiers" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "group_id" uuid NOT NULL,
        "name_ru" character varying NOT NULL,
        "name_uz" character varying NOT NULL,
        "price_delta" numeric(12,2) NOT NULL DEFAULT '0',
        "is_active" boolean NOT NULL DEFAULT true,
        "sort_order" integer NOT NULL DEFAULT 0,
        CONSTRAINT "PK_modifiers" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_modifiers_group" ON "modifiers" ("group_id", "is_active")`);

    await queryRunner.query(`
      CREATE TABLE "menu_item_modifier_groups" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "menu_item_id" uuid NOT NULL,
        "group_id" uuid NOT NULL,
        "sort_order" integer NOT NULL DEFAULT 0,
        CONSTRAINT "PK_menu_item_modifier_groups" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_menu_item_modifier_group" ON "menu_item_modifier_groups" ("menu_item_id", "group_id")`,
    );

    await queryRunner.query(`
      ALTER TABLE "modifier_groups" ADD CONSTRAINT "FK_modifier_groups_business"
        FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "modifiers" ADD CONSTRAINT "FK_modifiers_group"
        FOREIGN KEY ("group_id") REFERENCES "modifier_groups"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "menu_item_modifier_groups" ADD CONSTRAINT "FK_mimg_menu_item"
        FOREIGN KEY ("menu_item_id") REFERENCES "menu_items"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "menu_item_modifier_groups" ADD CONSTRAINT "FK_mimg_group"
        FOREIGN KEY ("group_id") REFERENCES "modifier_groups"("id") ON DELETE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "menu_item_modifier_groups"`);
    await queryRunner.query(`DROP TABLE "modifiers"`);
    await queryRunner.query(`DROP TABLE "modifier_groups"`);
    await queryRunner.query(`DROP TYPE "public"."modifier_groups_pricing_type_enum"`);
    await queryRunner.query(`DROP TYPE "public"."modifier_groups_selection_type_enum"`);
    await queryRunner.query(`DROP TYPE "public"."modifier_groups_kind_enum"`);
  }
}
