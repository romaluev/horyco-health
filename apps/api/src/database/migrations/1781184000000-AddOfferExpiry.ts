import { MigrationInterface, QueryRunner } from 'typeorm';

/** Offer TTL + expired recipient status for cron cleanup. */
export class AddOfferExpiry1781184000000 implements MigrationInterface {
  name = 'AddOfferExpiry1781184000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "offers" ADD "expires_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."offer_recipients_status_enum" ADD VALUE IF NOT EXISTS 'expired'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "offers" DROP COLUMN "expires_at"`);
    // PostgreSQL does not support removing enum values; leave 'expired' in place on revert.
  }
}
