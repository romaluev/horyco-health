import { MigrationInterface, QueryRunner } from 'typeorm';

/** Recipe card fields: instructions (jsonb), tip_ru/tip_uz (text). */
export class AddRecipeFields1781188000000 implements MigrationInterface {
  name = 'AddRecipeFields1781188000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "menu_items"
        ADD COLUMN "instructions" jsonb,
        ADD COLUMN "tip_ru" text,
        ADD COLUMN "tip_uz" text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "menu_items"
        DROP COLUMN "instructions",
        DROP COLUMN "tip_ru",
        DROP COLUMN "tip_uz"
    `);
  }
}
