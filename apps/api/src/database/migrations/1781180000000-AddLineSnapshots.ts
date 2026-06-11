import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 5: nullable menu_item_id + snapshot columns on order_items.
 * Backfills name/nutrition from joined menu_items for existing rows.
 */
export class AddLineSnapshots1781180000000 implements MigrationInterface {
  name = 'AddLineSnapshots1781180000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."order_items_kind_enum" AS ENUM('dish', 'combo')`,
    );
    await queryRunner.query(`ALTER TABLE "order_items" ADD "kind" "public"."order_items_kind_enum" NOT NULL DEFAULT 'dish'`);
    await queryRunner.query(`ALTER TABLE "order_items" ADD "combo_id" uuid`);
    await queryRunner.query(`ALTER TABLE "order_items" ADD "name_ru_snapshot" character varying`);
    await queryRunner.query(`ALTER TABLE "order_items" ADD "name_uz_snapshot" character varying`);
    await queryRunner.query(`ALTER TABLE "order_items" ADD "nutrition_snapshot" jsonb`);
    await queryRunner.query(`ALTER TABLE "order_items" ADD "ingredients_snapshot" jsonb`);
    await queryRunner.query(`ALTER TABLE "order_items" ADD "allergens_snapshot" jsonb`);
    await queryRunner.query(`ALTER TABLE "order_items" ADD "modifiers_snapshot" jsonb`);
    await queryRunner.query(`ALTER TABLE "order_items" ADD "combo_selections_snapshot" jsonb`);

    // Backfill snapshots from menu_items join.
    await queryRunner.query(`
      UPDATE order_items oi SET
        name_ru_snapshot = mi.name_ru,
        name_uz_snapshot = mi.name_uz,
        nutrition_snapshot = CASE WHEN oi.portion = 2 THEN mi.nutrition2 ELSE mi.nutrition END,
        ingredients_snapshot = mi.ingredients,
        allergens_snapshot = mi.allergens
      FROM menu_items mi
      WHERE oi.menu_item_id = mi.id
    `);

    await queryRunner.query(`ALTER TABLE "order_items" ALTER COLUMN "menu_item_id" DROP NOT NULL`);
    await queryRunner.query(
      `ALTER TABLE "order_items" ALTER COLUMN "name_ru_snapshot" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_items" ALTER COLUMN "name_uz_snapshot" SET NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM order_items WHERE menu_item_id IS NULL`);
    await queryRunner.query(`ALTER TABLE "order_items" ALTER COLUMN "menu_item_id" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "order_items" DROP COLUMN "combo_selections_snapshot"`);
    await queryRunner.query(`ALTER TABLE "order_items" DROP COLUMN "modifiers_snapshot"`);
    await queryRunner.query(`ALTER TABLE "order_items" DROP COLUMN "allergens_snapshot"`);
    await queryRunner.query(`ALTER TABLE "order_items" DROP COLUMN "ingredients_snapshot"`);
    await queryRunner.query(`ALTER TABLE "order_items" DROP COLUMN "nutrition_snapshot"`);
    await queryRunner.query(`ALTER TABLE "order_items" DROP COLUMN "name_uz_snapshot"`);
    await queryRunner.query(`ALTER TABLE "order_items" DROP COLUMN "name_ru_snapshot"`);
    await queryRunner.query(`ALTER TABLE "order_items" DROP COLUMN "combo_id"`);
    await queryRunner.query(`ALTER TABLE "order_items" DROP COLUMN "kind"`);
    await queryRunner.query(`DROP TYPE "public"."order_items_kind_enum"`);
  }
}
