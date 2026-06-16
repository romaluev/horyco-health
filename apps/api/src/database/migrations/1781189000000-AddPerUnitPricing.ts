import { MigrationInterface, QueryRunner } from 'typeorm';

/** Per-unit pricing on menu_items + unitAmount snapshot on order_items. */
export class AddPerUnitPricing1781189000000 implements MigrationInterface {
  name = 'AddPerUnitPricing1781189000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "menu_items_pricing_mode_enum" AS ENUM ('fixed', 'per_unit')
    `);
    await queryRunner.query(`
      CREATE TYPE "menu_items_unit_kind_enum" AS ENUM ('gram', 'piece')
    `);
    await queryRunner.query(`
      ALTER TABLE "menu_items"
        ADD COLUMN "pricing_mode" "menu_items_pricing_mode_enum" NOT NULL DEFAULT 'fixed',
        ADD COLUMN "unit_kind" "menu_items_unit_kind_enum",
        ADD COLUMN "unit_step" int,
        ADD COLUMN "unit_min" int,
        ADD COLUMN "unit_max" int,
        ADD COLUMN "price_per_step" numeric(12,2),
        ADD COLUMN "unit_default" int
    `);
    await queryRunner.query(`
      ALTER TABLE "order_items"
        ADD COLUMN "unit_amount_at_order" int
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "order_items" DROP COLUMN "unit_amount_at_order"`);
    await queryRunner.query(`
      ALTER TABLE "menu_items"
        DROP COLUMN "unit_default",
        DROP COLUMN "price_per_step",
        DROP COLUMN "unit_max",
        DROP COLUMN "unit_min",
        DROP COLUMN "unit_step",
        DROP COLUMN "unit_kind",
        DROP COLUMN "pricing_mode"
    `);
    await queryRunner.query(`DROP TYPE "menu_items_unit_kind_enum"`);
    await queryRunner.query(`DROP TYPE "menu_items_pricing_mode_enum"`);
  }
}
