import { MigrationInterface, QueryRunner } from 'typeorm';

/** Phase 8: combos, slots, options, combo_modifier_groups. */
export class AddCombos1781183000000 implements MigrationInterface {
  name = 'AddCombos1781183000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "combos" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "business_id" uuid NOT NULL,
        "name_ru" character varying NOT NULL,
        "name_uz" character varying NOT NULL,
        "description_ru" text,
        "description_uz" text,
        "price" numeric(12,2) NOT NULL,
        "original_price" numeric(12,2),
        "photo_file_id" character varying,
        "photo_url" character varying,
        "order_deadline" character varying(5),
        "days" integer array NOT NULL DEFAULT '{}',
        "is_active" boolean NOT NULL DEFAULT true,
        CONSTRAINT "PK_combos" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_combos_business" ON "combos" ("business_id", "is_active")`);

    await queryRunner.query(`
      CREATE TABLE "combo_slots" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "combo_id" uuid NOT NULL,
        "name_ru" character varying NOT NULL,
        "name_uz" character varying NOT NULL,
        "sort_order" integer NOT NULL DEFAULT 0,
        CONSTRAINT "PK_combo_slots" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_combo_slots_combo" ON "combo_slots" ("combo_id")`);

    await queryRunner.query(`
      CREATE TABLE "combo_slot_options" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "slot_id" uuid NOT NULL,
        "menu_item_id" uuid NOT NULL,
        "price_override" numeric(12,2) NOT NULL DEFAULT '0',
        "is_default" boolean NOT NULL DEFAULT false,
        "sort_order" integer NOT NULL DEFAULT 0,
        CONSTRAINT "PK_combo_slot_options" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_combo_slot_options_slot" ON "combo_slot_options" ("slot_id")`);

    await queryRunner.query(`
      CREATE TABLE "combo_modifier_groups" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "combo_id" uuid NOT NULL,
        "group_id" uuid NOT NULL,
        "sort_order" integer NOT NULL DEFAULT 0,
        CONSTRAINT "PK_combo_modifier_groups" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_combo_modifier_group" ON "combo_modifier_groups" ("combo_id", "group_id")`,
    );

    await queryRunner.query(`
      ALTER TABLE "combos" ADD CONSTRAINT "FK_combos_business"
        FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "combo_slots" ADD CONSTRAINT "FK_combo_slots_combo"
        FOREIGN KEY ("combo_id") REFERENCES "combos"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "combo_slot_options" ADD CONSTRAINT "FK_combo_slot_options_slot"
        FOREIGN KEY ("slot_id") REFERENCES "combo_slots"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "combo_slot_options" ADD CONSTRAINT "FK_combo_slot_options_menu_item"
        FOREIGN KEY ("menu_item_id") REFERENCES "menu_items"("id")
    `);
    await queryRunner.query(`
      ALTER TABLE "combo_modifier_groups" ADD CONSTRAINT "FK_cmg_combo"
        FOREIGN KEY ("combo_id") REFERENCES "combos"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "combo_modifier_groups" ADD CONSTRAINT "FK_cmg_group"
        FOREIGN KEY ("group_id") REFERENCES "modifier_groups"("id") ON DELETE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "combo_modifier_groups"`);
    await queryRunner.query(`DROP TABLE "combo_slot_options"`);
    await queryRunner.query(`DROP TABLE "combo_slots"`);
    await queryRunner.query(`DROP TABLE "combos"`);
  }
}
