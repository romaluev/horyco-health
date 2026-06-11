import { Injectable } from '@nestjs/common';
import { EntityTarget } from 'typeorm';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { ChatKind, ChatStatus } from '@eatfit/shared';
import { TransactionalRepository } from '../common/database/transactional-repository';
import { BusinessChat } from './entities/business-chat.entity';

@Injectable()
export class BusinessChatsRepository extends TransactionalRepository<BusinessChat> {
  protected readonly entity: EntityTarget<BusinessChat> = BusinessChat;

  constructor(txHost: TransactionHost<TransactionalAdapterTypeOrm>) {
    super(txHost);
  }

  find(businessId: string, kind: ChatKind): Promise<BusinessChat | null> {
    return this.repo.findOne({ where: { businessId, kind } });
  }

  /** Активная привязка чата (сломанные не используются для отправки). */
  findActive(businessId: string, kind: ChatKind): Promise<BusinessChat | null> {
    return this.repo.findOne({ where: { businessId, kind, status: ChatStatus.Active } });
  }

  findAll(businessId: string): Promise<BusinessChat[]> {
    return this.repo.find({ where: { businessId }, order: { kind: 'ASC' } });
  }

  /** Привязать/перепривязать чат роли (UNIQUE business+kind → upsert). */
  async bind(businessId: string, kind: ChatKind, chatId: string, title: string | null): Promise<void> {
    await this.txHost.tx.query(
      `INSERT INTO business_chats (business_id, kind, chat_id, title, status)
       VALUES ($1, $2, $3, $4, 'active')
       ON CONFLICT (business_id, kind)
       DO UPDATE SET chat_id = EXCLUDED.chat_id, title = EXCLUDED.title, status = 'active', updated_at = now()`,
      [businessId, kind, chatId, title],
    );
  }

  /** Пометить привязку сломанной (бота выгнали из чата). */
  async markBroken(businessId: string, chatId: string): Promise<void> {
    await this.txHost.tx.query(
      `UPDATE business_chats SET status = 'broken', updated_at = now()
       WHERE business_id = $1 AND chat_id = $2`,
      [businessId, chatId],
    );
  }
}
