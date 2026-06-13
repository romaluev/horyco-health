import { MigrationInterface, QueryRunner } from 'typeorm';

/** Telegram message id for in-place client order status updates. */
export class AddClientNotifyMsgId1781187000000 implements MigrationInterface {
  name = 'AddClientNotifyMsgId1781187000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "orders"
        ADD COLUMN "client_notify_msg_id" bigint
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "orders"
        DROP COLUMN "client_notify_msg_id"
    `);
  }
}
