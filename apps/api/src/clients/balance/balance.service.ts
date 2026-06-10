import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { BalanceTransactionType } from '@eatfit/shared';
import { InsufficientBalanceError, NotFoundError } from '../../common/errors/domain-error';
import { Money } from '../../common/money/money';
import { Client } from '../entities/client.entity';
import { ClientRepository } from '../clients.repository';
import { BalanceRepository } from './balance.repository';

/**
 * Единственная точка изменения баланса (архитектура §Деньги). Все операции — в транзакции
 * с FOR UPDATE на строке клиента; неотрицательность баланса проверяется до commit (плюс
 * БД-CHECK как последний рубеж). Каждое движение пишется в append-only ledger.
 * Идемпотентность по orderId+type обеспечивается уникальным индексом ledger.
 */
@Injectable()
export class BalanceService {
  constructor(
    private readonly clients: ClientRepository,
    private readonly ledger: BalanceRepository,
  ) {}

  /** Пополнение (только админом — вызывается из DepositsService). */
  @Transactional()
  deposit(clientId: string, amount: Money, idempotencyKey: string | null = null): Promise<ApplyResult> {
    return this.apply(clientId, amount, BalanceTransactionType.Deposit, null, idempotencyKey);
  }

  /** Ручное списание админом (коррекция баланса). Не уводит баланс в минус. */
  @Transactional()
  adminDebit(clientId: string, amount: Money, idempotencyKey: string | null = null): Promise<ApplyResult> {
    return this.apply(
      clientId,
      Money.zero().subtract(amount),
      BalanceTransactionType.AdminDebit,
      null,
      idempotencyKey,
    );
  }

  /** Списание за заказ. */
  @Transactional()
  async charge(clientId: string, amount: Money, orderId: string): Promise<Client> {
    const { client } = await this.apply(
      clientId,
      Money.zero().subtract(amount),
      BalanceTransactionType.OrderCharge,
      orderId,
      `charge:${orderId}`,
    );
    return client;
  }

  /** Возврат при отмене заказа. */
  @Transactional()
  async refund(clientId: string, amount: Money, orderId: string): Promise<Client> {
    const { client } = await this.apply(
      clientId,
      amount,
      BalanceTransactionType.OrderRefund,
      orderId,
      `refund:${orderId}`,
    );
    return client;
  }

  private async apply(
    clientId: string,
    delta: Money,
    type: BalanceTransactionType,
    orderId: string | null,
    idempotencyKey: string | null,
  ): Promise<ApplyResult> {
    const client = await this.clients.findByIdForUpdate(clientId);
    if (!client) {
      throw new NotFoundError('Клиент не найден');
    }

    // Идемпотентность: проверка под FOR UPDATE (строка клиента залочена) — повторная команда
    // с тем же ключом не применяется второй раз; возвращаем уже зафиксированный баланс.
    if (idempotencyKey) {
      const existing = await this.ledger.findByIdempotencyKey(idempotencyKey);
      if (existing) {
        return { client, applied: false };
      }
    }

    const newBalance = client.balance.add(delta);
    if (newBalance.isNegative()) {
      throw new InsufficientBalanceError();
    }

    client.balance = newBalance;
    await this.clients.save(client);
    await this.ledger.create({
      clientId,
      type,
      amount: delta,
      balanceAfter: newBalance,
      orderId,
      idempotencyKey,
    });
    return { client, applied: true };
  }
}

/** Результат проводки: клиент после операции и флаг, была ли она реально применена (vs дедуп). */
export interface ApplyResult {
  client: Client;
  applied: boolean;
}
