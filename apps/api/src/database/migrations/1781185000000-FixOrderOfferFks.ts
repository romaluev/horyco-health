import { MigrationInterface, QueryRunner } from 'typeorm';

/** Orphan cleanup + FK constraints for orders/offers/combos links. */
export class FixOrderOfferFks1781185000000 implements MigrationInterface {
  name = 'FixOrderOfferFks1781185000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Orphan cleanup before NOT NULL / FK constraints.
    await queryRunner.query(`
      UPDATE order_items SET
        name_ru_snapshot = COALESCE(name_ru_snapshot, '—'),
        name_uz_snapshot = COALESCE(name_uz_snapshot, '—')
      WHERE name_ru_snapshot IS NULL OR name_uz_snapshot IS NULL
    `);
    await queryRunner.query(`
      UPDATE order_items SET combo_id = NULL
      WHERE combo_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM combos c WHERE c.id = order_items.combo_id)
    `);
    await queryRunner.query(`
      UPDATE orders SET offer_id = NULL
      WHERE offer_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM offers o WHERE o.id = orders.offer_id)
    `);
    await queryRunner.query(`
      UPDATE offer_recipients SET order_id = NULL
      WHERE order_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.id = offer_recipients.order_id)
    `);

    await queryRunner.query(`
      ALTER TABLE "orders" ADD CONSTRAINT "FK_orders_offer"
        FOREIGN KEY ("offer_id") REFERENCES "offers"("id") ON DELETE SET NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "offer_recipients" ADD CONSTRAINT "FK_offer_recipients_order"
        FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "order_items" ADD CONSTRAINT "FK_order_items_combo"
        FOREIGN KEY ("combo_id") REFERENCES "combos"("id") ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "order_items" DROP CONSTRAINT IF EXISTS "FK_order_items_combo"`,
    );
    await queryRunner.query(
      `ALTER TABLE "offer_recipients" DROP CONSTRAINT IF EXISTS "FK_offer_recipients_order"`,
    );
    await queryRunner.query(`ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "FK_orders_offer"`);
  }
}
