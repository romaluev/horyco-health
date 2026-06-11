import { randomUUID } from 'crypto';
import { Inject, Injectable, Optional } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import {
  balanceDepositAdminMessage,
  balanceDepositClientMessage,
  balanceWithdrawAdminMessage,
  balanceWithdrawClientMessage,
  escapeHtml,
} from '@eatfit/shared';
import { ActorContextService } from '../common/cls/actor-context.service';
import { NotFoundError } from '../common/errors/domain-error';
import { Money } from '../common/money/money';
import { INotifier, NOTIFIER, NotifyGroup } from '../common/notifications/notifier';
import { ClientRepository } from '../clients/clients.repository';
import { Client } from '../clients/entities/client.entity';
import { BalanceService } from '../clients/balance/balance.service';
import { DepositRepository } from './deposit.repository';
import { CreateDepositDto } from './dto/create-deposit.dto';
import { DepositResponseDto } from './dto/deposit-response.dto';

export interface AdminDepositResult {
  deposit: DepositResponseDto | null;
  balance: string;
}

interface BalanceNotifyPayload {
  businessId: string;
  target: Client;
  amount: Money;
  /** Баланс кошелька после операции. */
  newBalance: Money;
  direction: 'deposit' | 'debit';
}

@Injectable()
export class DepositsService {
  constructor(
    private readonly deposits: DepositRepository,
    private readonly clients: ClientRepository,
    private readonly balance: BalanceService,
    private readonly actorCtx: ActorContextService,
    @Optional() @Inject(NOTIFIER) private readonly notifier?: INotifier,
  ) {}

  async adminDeposit(dto: CreateDepositDto): Promise<AdminDepositResult> {
    const { result, notify } = await this.adminDepositInTransaction(dto);
    if (notify) {
      await this.notifyBalanceChange(notify);
    }
    return result;
  }

  @Transactional()
  private async adminDepositInTransaction(
    dto: CreateDepositDto,
  ): Promise<{ result: AdminDepositResult; notify?: BalanceNotifyPayload }> {
    const admin = this.actorCtx.getOrThrow();
    const businessId = admin.businessId;
    const target = await this.clients.findById(dto.clientId);
    if (!target) {
      throw new NotFoundError('Клиент не найден');
    }

    const amount = Money.fromMajor(dto.amount);
    const key = `deposit:${businessId}:${dto.idempotencyKey ?? randomUUID()}`;

    const { balance: newBalance, applied } = await this.balance.deposit(target.id, businessId, amount, key);
    if (!applied) {
      const [last] = await this.deposits.findByClient(businessId, target.id);
      return {
        result: {
          deposit: last ? new DepositResponseDto(last) : null,
          balance: newBalance.toString(),
        },
      };
    }

    const deposit = await this.deposits.create({
      businessId,
      clientId: target.id,
      amount,
      adminTelegramId: admin.telegramId,
    });

    return {
      result: { deposit: new DepositResponseDto(deposit), balance: newBalance.toString() },
      notify: { businessId, target, amount, newBalance, direction: 'deposit' },
    };
  }

  async adminWithdraw(dto: CreateDepositDto): Promise<{ balance: string }> {
    const { balance, notify } = await this.adminWithdrawInTransaction(dto);
    if (notify) {
      await this.notifyBalanceChange(notify);
    }
    return { balance };
  }

  @Transactional()
  private async adminWithdrawInTransaction(
    dto: CreateDepositDto,
  ): Promise<{ balance: string; notify?: BalanceNotifyPayload }> {
    const businessId = this.actorCtx.getOrThrow().businessId;
    const target = await this.clients.findById(dto.clientId);
    if (!target) {
      throw new NotFoundError('Клиент не найден');
    }

    const amount = Money.fromMajor(dto.amount);
    const key = `debit:${businessId}:${dto.idempotencyKey ?? randomUUID()}`;

    const { balance: newBalance, applied } = await this.balance.adminDebit(target.id, businessId, amount, key);
    if (!applied) {
      return { balance: newBalance.toString() };
    }

    return {
      balance: newBalance.toString(),
      notify: { businessId, target, amount, newBalance, direction: 'debit' },
    };
  }

  private async notifyBalanceChange(payload: BalanceNotifyPayload): Promise<void> {
    const { businessId, target, amount, newBalance, direction } = payload;
    const amt = amount.toString();
    const bal = newBalance.toString();
    const safeName = escapeHtml(target.name);

    const userMsg =
      direction === 'deposit'
        ? balanceDepositClientMessage(target.language, amt, bal)
        : balanceWithdrawClientMessage(target.language, amt, bal);
    const adminMsg =
      direction === 'deposit'
        ? balanceDepositAdminMessage(safeName, amt, bal)
        : balanceWithdrawAdminMessage(safeName, amt, bal);

    if (target.telegramId) {
      await this.notifier?.notifyUser(businessId, target.telegramId, userMsg);
    }
    await this.notifier?.notifyGroup(businessId, NotifyGroup.Admins, adminMsg);
  }

  async myHistory(): Promise<DepositResponseDto[]> {
    const actor = this.actorCtx.getOrThrow();
    return this.historyFor(actor.businessId, actor.userId);
  }

  /** История пополнений клиента (вызов от имени админа — businessId из актора). */
  async historyForAdmin(clientId: string): Promise<DepositResponseDto[]> {
    const businessId = this.actorCtx.getOrThrow().businessId;
    return this.historyFor(businessId, clientId);
  }

  async historyFor(businessId: string, clientId: string): Promise<DepositResponseDto[]> {
    const list = await this.deposits.findByClient(businessId, clientId);
    return list.map((d) => new DepositResponseDto(d));
  }
}
