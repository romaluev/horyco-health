import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { BalanceTransactionType } from '@eatfit/shared';
import { InsufficientBalanceError, NotFoundError } from '../../common/errors/domain-error';
import { Money } from '../../common/money/money';
import { ClientRepository } from '../clients.repository';
import { BusinessCustomersRepository } from '../../businesses/business-customers.repository';
import { BalanceRepository } from './balance.repository';

/**
 * Единственная точка изменения баланса (архитектура §Деньги). Кошелёк — строка
 * business_customers (per-бизнес); все операции в транзакции с FOR UPDATE на строке
 * КОШЕЛЬКА; неотрицательность проверяется до commit (плюс БД-CHECK как последний рубеж).
 * Каждое движение пишется в append-only ledger. Идемпотентность по orderId+type
 * обеспечивается уникальным индексом ledger.
 */
@Injectable()
export class BalanceService {
  constructor(
    private readonly clients: ClientRepository,
    private readonly wallets: BusinessCustomersRepository,
    private readonly ledger: BalanceRepository,
  ) {}

  /** Пополнение (только админом — вызывается из DepositsService). */
  @Transactional()
  deposit(
    clientId: string,
    businessId: string,
    amount: Money,
    idempotencyKey: string | null = null,
  ): Promise<ApplyResult> {
    return this.apply(clientId, businessId, amount, BalanceTransactionType.Deposit, null, idempotencyKey);
  }

  /** Ручное списание админом (коррекция баланса). Не уводит баланс в минус. */
  @Transactional()
  adminDebit(
    clientId: string,
    businessId: string,
    amount: Money,
    idempotencyKey: string | null = null,
  ): Promise<ApplyResult> {
    return this.apply(
      clientId,
      businessId,
      Money.zero().subtract(amount),
      BalanceTransactionType.AdminDebit,
      null,
      idempotencyKey,
    );
  }

  /** Списание за заказ. */
  @Transactional()
  charge(clientId: string, businessId: string, amount: Money, orderId: string): Promise<ApplyResult> {
    return this.apply(
      clientId,
      businessId,
      Money.zero().subtract(amount),
      BalanceTransactionType.OrderCharge,
      orderId,
      `charge:${orderId}`,
    );
  }

  /** Возврат при отмене заказа. */
  @Transactional()
  refund(clientId: string, businessId: string, amount: Money, orderId: string): Promise<ApplyResult> {
    return this.apply(clientId, businessId, amount, BalanceTransactionType.OrderRefund, orderId, `refund:${orderId}`);
  }

  /** Текущий баланс клиента у бизнеса (кошелька может ещё не быть — тогда ноль). */
  async balanceOf(clientId: string, businessId: string): Promise<Money> {
    const wallet = await this.wallets.find(businessId, clientId);
    return wallet?.balance ?? Money.zero();
  }

  private async apply(
    clientId: string,
    businessId: string,
    delta: Money,
    type: BalanceTransactionType,
    orderId: string | null,
    idempotencyKey: string | null,
  ): Promise<ApplyResult> {
    const client = await this.clients.findById(clientId);
    if (!client) {
      throw new NotFoundError('Клиент не найден');
    }

    // Кошелёк создаётся лениво и блокируется FOR UPDATE — конкурентные операции сериализуются.
    const wallet = await this.wallets.findForUpdateOrCreate(businessId, clientId);

    // Идемпотентность: проверка под блокировкой кошелька — повторная команда с тем же
    // ключом не применяется второй раз; возвращаем уже зафиксированный баланс.
    if (idempotencyKey) {
      const existing = await this.ledger.findByIdempotencyKey(idempotencyKey);
      if (existing) {
        return { balance: wallet.balance, applied: false };
      }
    }

    const newBalance = wallet.balance.add(delta);
    if (newBalance.isNegative()) {
      throw new InsufficientBalanceError();
    }

    wallet.balance = newBalance;
    await this.wallets.save(wallet);
    await this.ledger.create({
      businessId,
      clientId,
      type,
      amount: delta,
      balanceAfter: newBalance,
      orderId,
      idempotencyKey,
    });
    return { balance: newBalance, applied: true };
  }
}

/** Результат проводки: баланс кошелька после операции и был ли он реально применён (vs дедуп). */
export interface ApplyResult {
  balance: Money;
  applied: boolean;
}
