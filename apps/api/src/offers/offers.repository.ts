import { Injectable } from '@nestjs/common';
import { EntityTarget } from 'typeorm';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { TransactionalRepository } from '../common/database/transactional-repository';
import { Offer, OfferRecipient, OfferRecipientStatus, OfferStatus } from './entities/offer.entity';

@Injectable()
export class OffersRepository extends TransactionalRepository<Offer> {
  protected readonly entity: EntityTarget<Offer> = Offer;

  constructor(txHost: TransactionHost<TransactionalAdapterTypeOrm>) {
    super(txHost);
  }

  findById(businessId: string, id: string): Promise<Offer | null> {
    return this.repo.findOne({ where: { id, businessId } });
  }

  findAll(businessId: string): Promise<Offer[]> {
    return this.repo.find({ where: { businessId }, order: { createdAt: 'DESC' } });
  }

  save(data: Partial<Offer>): Promise<Offer> {
    return this.repo.save(this.repo.create(data));
  }

  private recipientRepo() {
    return this.txHost.tx.getRepository(OfferRecipient);
  }

  findRecipientById(businessId: string, id: string): Promise<OfferRecipient | null> {
    return this.recipientRepo().findOne({
      where: { id, offer: { businessId } },
      relations: { offer: true, client: true },
    });
  }

  findRecipients(businessId: string, offerId: string): Promise<OfferRecipient[]> {
    return this.recipientRepo().find({
      where: { offerId, offer: { businessId } },
      relations: { client: true },
      order: { createdAt: 'ASC' },
    });
  }

  async saveRecipients(businessId: string, rows: Partial<OfferRecipient>[]): Promise<OfferRecipient[]> {
    if (rows.length === 0) return [];
    const clientIds = [...new Set(rows.map((r) => r.clientId).filter((id): id is string => !!id))];
    const valid: { client_id: string }[] = await this.txHost.tx.query(
      `SELECT client_id FROM business_customers WHERE business_id = $1 AND client_id = ANY($2::uuid[])`,
      [businessId, clientIds],
    );
    if (valid.length !== clientIds.length) {
      throw new Error('OFFER_RECIPIENTS_NOT_CUSTOMERS');
    }
    const repo = this.recipientRepo();
    return repo.save(repo.create(rows));
  }

  /**
   * Atomic claim: only one concurrent accept wins. Returns claimed row or null.
   */
  async claimRecipientForOrder(businessId: string, recipientId: string): Promise<OfferRecipient | null> {
    const rows: OfferRecipient[] = await this.txHost.tx.query(
      `UPDATE offer_recipients r
       SET status = 'ordered', updated_at = now()
       FROM offers o
       WHERE r.id = $1
         AND r.offer_id = o.id
         AND o.business_id = $2
         AND r.status IN ('sent', 'opened')
       RETURNING r.id, r.created_at AS "createdAt", r.updated_at AS "updatedAt",
                 r.offer_id AS "offerId", r.client_id AS "clientId", r.status,
                 r.telegram_message_id AS "telegramMessageId", r.error_message AS "errorMessage",
                 r.order_id AS "orderId", r.opened_at AS "openedAt", r.ordered_at AS "orderedAt"`,
      [recipientId, businessId],
    );
    return rows[0] ?? null;
  }

  async setRecipientOrderId(businessId: string, recipientId: string, orderId: string): Promise<void> {
    await this.txHost.tx.query(
      `UPDATE offer_recipients r
       SET order_id = $3, ordered_at = COALESCE(r.ordered_at, now()), updated_at = now()
       FROM offers o
       WHERE r.id = $1 AND r.offer_id = o.id AND o.business_id = $2 AND r.status = 'ordered'`,
      [recipientId, businessId, orderId],
    );
  }

  async setRecipientStatus(
    businessId: string,
    id: string,
    status: OfferRecipientStatus,
    extra: Partial<OfferRecipient> = {},
    expectedStatuses?: OfferRecipientStatus[],
  ): Promise<boolean> {
    const setClauses = ['status = $3', 'updated_at = now()'];
    const params: unknown[] = [id, businessId, status];
    let paramIdx = 4;

    if (extra.orderId !== undefined) {
      setClauses.push(`order_id = $${paramIdx++}`);
      params.push(extra.orderId);
    }
    if (extra.openedAt !== undefined) {
      setClauses.push(`opened_at = $${paramIdx++}`);
      params.push(extra.openedAt);
    }
    if (extra.orderedAt !== undefined) {
      setClauses.push(`ordered_at = $${paramIdx++}`);
      params.push(extra.orderedAt);
    }
    if (extra.errorMessage !== undefined) {
      setClauses.push(`error_message = $${paramIdx++}`);
      params.push(extra.errorMessage);
    }
    if (extra.telegramMessageId !== undefined) {
      setClauses.push(`telegram_message_id = $${paramIdx++}`);
      params.push(extra.telegramMessageId);
    }

    let statusGuard = '';
    if (expectedStatuses?.length) {
      statusGuard = `AND r.status = ANY($${paramIdx++}::offer_recipients_status_enum[])`;
      params.push(expectedStatuses);
    }

    const result: { id: string }[] = await this.txHost.tx.query(
      `UPDATE offer_recipients r
       SET ${setClauses.join(', ')}
       FROM offers o
       WHERE r.id = $1 AND r.offer_id = o.id AND o.business_id = $2 ${statusGuard}
       RETURNING r.id`,
      params,
    );
    return result.length > 0;
  }

  async clearRecipients(businessId: string, offerId: string): Promise<void> {
    await this.txHost.tx.query(
      `DELETE FROM offer_recipients r
       USING offers o
       WHERE r.offer_id = $1 AND r.offer_id = o.id AND o.business_id = $2`,
      [offerId, businessId],
    );
  }

  findSendingOffers(): Promise<Offer[]> {
    return this.repo.find({ where: { status: OfferStatus.Sending } });
  }

  countRecipientsByStatus(businessId: string, offerId: string): Promise<Record<string, number>> {
    return this.recipientRepo()
      .createQueryBuilder('r')
      .innerJoin('r.offer', 'o')
      .select('r.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('r.offer_id = :offerId AND o.business_id = :businessId', { offerId, businessId })
      .groupBy('r.status')
      .getRawMany()
      .then((rows) =>
        Object.fromEntries(rows.map((r: { status: string; count: string }) => [r.status, Number(r.count)])),
      );
  }

  /** Mark sent/opened recipients expired when parent offer TTL elapsed. */
  async expireRecipientsPastTtl(): Promise<number> {
    const rows: { id: string }[] = await this.txHost.tx.query(
      `UPDATE offer_recipients r
       SET status = 'expired', updated_at = now()
       FROM offers o
       WHERE r.offer_id = o.id
         AND o.expires_at IS NOT NULL
         AND o.expires_at < now()
         AND r.status IN ('sent', 'opened')
       RETURNING r.id`,
    );
    return rows.length;
  }
}
