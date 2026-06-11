import { Injectable } from '@nestjs/common';
import { EntityTarget, In } from 'typeorm';
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

  saveRecipients(businessId: string, rows: Partial<OfferRecipient>[]): Promise<OfferRecipient[]> {
    void businessId;
    const repo = this.recipientRepo();
    return repo.save(repo.create(rows));
  }

  async setRecipientStatus(
    businessId: string,
    id: string,
    status: OfferRecipientStatus,
    extra: Partial<OfferRecipient> = {},
  ): Promise<void> {
    const row = await this.findRecipientById(businessId, id);
    if (!row) return;
    await this.recipientRepo().update({ id }, { status, ...extra });
  }

  async clearRecipients(businessId: string, offerId: string): Promise<void> {
    void businessId;
    await this.recipientRepo().delete({ offerId });
  }

  findSendingOffers(): Promise<Offer[]> {
    return this.repo.find({ where: { status: OfferStatus.Sending } });
  }

  countRecipientsByStatus(businessId: string, offerId: string): Promise<Record<string, number>> {
    void businessId;
    return this.recipientRepo()
      .createQueryBuilder('r')
      .select('r.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('r.offer_id = :offerId', { offerId })
      .groupBy('r.status')
      .getRawMany()
      .then((rows) =>
        Object.fromEntries(rows.map((r: { status: string; count: string }) => [r.status, Number(r.count)])),
      );
  }
}
