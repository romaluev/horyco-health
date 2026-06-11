import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Перенос кошельков: clients.balance → business_customers.balance (Бизнес #1).
 * Контрольная сумма ДО drop'а: SUM(clients.balance) == SUM(business_customers.balance),
 * иначе исключение и полный откат (миграция идёт в транзакции). Обратима.
 */
export class MoveWalletsAndRoles1781178200000 implements MigrationInterface {
  name = 'MoveWalletsAndRoles1781178200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const [{ id: bizId }]: { id: string }[] = await queryRunner.query(
      `SELECT id FROM businesses WHERE slug = 'eatfit' LIMIT 1`,
    );
    if (!bizId) {
      throw new Error('MoveWallets: бизнес eatfit не найден (AddTenancy не применена?)');
    }

    // Клиенты, появившиеся после AddTenancy, могли не получить CRM-строку — досоздаём.
    await queryRunner.query(
      `INSERT INTO business_customers (business_id, client_id)
       SELECT $1, id FROM clients ON CONFLICT (business_id, client_id) DO NOTHING`,
      [bizId],
    );

    await queryRunner.query(
      `UPDATE business_customers bc SET balance = c.balance, updated_at = now()
       FROM clients c WHERE bc.client_id = c.id AND bc.business_id = $1`,
      [bizId],
    );

    // Контрольная сумма: деньги не теряются и не возникают.
    const [{ src, dst }]: { src: string; dst: string }[] = await queryRunner.query(
      `SELECT (SELECT COALESCE(SUM(balance), 0)::text FROM clients) AS src,
              (SELECT COALESCE(SUM(balance), 0)::text FROM business_customers WHERE business_id = $1) AS dst`,
      [bizId],
    );
    if (src !== dst) {
      throw new Error(`MoveWallets: контрольная сумма не сошлась (clients=${src}, wallets=${dst}) — откат`);
    }

    await queryRunner.query(`ALTER TABLE "clients" DROP CONSTRAINT "CHK_05fe11605ba789332f9d3db0ec"`);
    await queryRunner.query(`ALTER TABLE "clients" DROP COLUMN "balance"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "clients" ADD "balance" numeric(12,2) NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "clients" ADD CONSTRAINT "CHK_05fe11605ba789332f9d3db0ec" CHECK ("balance" >= 0)`,
    );
    await queryRunner.query(
      `UPDATE clients c SET balance = bc.balance
       FROM business_customers bc
       WHERE bc.client_id = c.id
         AND bc.business_id = (SELECT id FROM businesses WHERE slug = 'eatfit' LIMIT 1)`,
    );
  }
}
