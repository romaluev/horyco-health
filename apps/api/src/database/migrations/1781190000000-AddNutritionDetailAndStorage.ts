import { MigrationInterface, QueryRunner } from 'typeorm';

/** Extended nutrition table + storage/reheat from tech cards. */
export class AddNutritionDetailAndStorage1781190000000 implements MigrationInterface {
  name = 'AddNutritionDetailAndStorage1781190000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "menu_items"
        ADD COLUMN "nutrition_detail" jsonb,
        ADD COLUMN "storage_handling" jsonb
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "menu_items"
        DROP COLUMN "nutrition_detail",
        DROP COLUMN "storage_handling"
    `);
  }
}
