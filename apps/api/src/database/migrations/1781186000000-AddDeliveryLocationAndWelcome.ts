import { MigrationInterface, QueryRunner } from 'typeorm';

/** Delivery coordinates on clients/orders; per-business welcome messages. */
export class AddDeliveryLocationAndWelcome1781186000000 implements MigrationInterface {
  name = 'AddDeliveryLocationAndWelcome1781186000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "clients"
        ADD COLUMN "delivery_lat" numeric(10,7),
        ADD COLUMN "delivery_lng" numeric(10,7)
    `);
    await queryRunner.query(`
      ALTER TABLE "orders"
        ADD COLUMN "delivery_lat" numeric(10,7),
        ADD COLUMN "delivery_lng" numeric(10,7)
    `);
    await queryRunner.query(`
      ALTER TABLE "businesses"
        ADD COLUMN "welcome_message_ru" text,
        ADD COLUMN "welcome_message_uz" text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "businesses"
        DROP COLUMN "welcome_message_uz",
        DROP COLUMN "welcome_message_ru"
    `);
    await queryRunner.query(`
      ALTER TABLE "orders"
        DROP COLUMN "delivery_lng",
        DROP COLUMN "delivery_lat"
    `);
    await queryRunner.query(`
      ALTER TABLE "clients"
        DROP COLUMN "delivery_lng",
        DROP COLUMN "delivery_lat"
    `);
  }
}
