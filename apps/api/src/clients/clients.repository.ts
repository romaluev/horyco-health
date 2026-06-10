import { Injectable } from '@nestjs/common';
import { EntityTarget, IsNull, Not } from 'typeorm';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { TransactionalRepository } from '../common/database/transactional-repository';
import { Money } from '../common/money/money';
import { Client } from './entities/client.entity';

@Injectable()
export class ClientRepository extends TransactionalRepository<Client> {
  protected readonly entity: EntityTarget<Client> = Client;

  constructor(txHost: TransactionHost<TransactionalAdapterTypeOrm>) {
    super(txHost);
  }

  findByTelegramId(telegramId: string): Promise<Client | null> {
    return this.repo.findOne({ where: { telegramId } });
  }

  /** Веб-аккаунт по телефону (только с паролем — Telegram-клиенты не участвуют). */
  findWebByPhone(phone: string): Promise<Client | null> {
    return this.repo.findOne({ where: { phone, passwordHash: Not(IsNull()) } });
  }

  findById(id: string): Promise<Client | null> {
    return this.repo.findOne({ where: { id } });
  }

  /** Загрузка клиента с блокировкой строки (для денежных операций; нужна транзакция). */
  findByIdForUpdate(id: string): Promise<Client | null> {
    return this.repo
      .createQueryBuilder('client')
      .setLock('pessimistic_write')
      .where('client.id = :id', { id })
      .getOne();
  }

  /** Поиск клиентов админом по телефону / @username / telegram_id (живой фильтр). */
  search(term?: string): Promise<Client[]> {
    const qb = this.repo.createQueryBuilder('client').orderBy('client.createdAt', 'DESC');
    if (term && term.trim()) {
      qb.where(
        'client.phone ILIKE :t OR client.username ILIKE :t OR CAST(client.telegramId AS TEXT) ILIKE :t',
        { t: `%${term.trim()}%` },
      );
    }
    return qb.getMany();
  }

  create(data: Partial<Client>): Promise<Client> {
    // Денежный трансформер пишет null при undefined (перебивая DB-default) → задаём
    // нулевой баланс по умолчанию; явный balance в data его переопределяет.
    return this.repo.save(this.repo.create({ balance: Money.zero(), ...data }));
  }

  save(client: Client): Promise<Client> {
    return this.repo.save(client);
  }
}
