import { randomUUID } from 'crypto';
import { Inject, Injectable, Optional } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
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
  deposit: DepositResponseDto | null; // null — повторная (идемпотентная) команда без новой записи
  balance: string;
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

  /** Пополнение баланса админом: Deposit + проводка по балансу в одной транзакции. */
  @Transactional()
  async adminDeposit(dto: CreateDepositDto): Promise<AdminDepositResult> {
    const admin = this.actorCtx.getOrThrow();
    const target = await this.clients.findById(dto.clientId);
    if (!target) {
      throw new NotFoundError('Клиент не найден');
    }

    const amount = Money.fromMajor(dto.amount);
    // Ключ в пространстве «deposit:» — не пересекается с ключами списаний/заказов.
    const key = `deposit:${dto.idempotencyKey ?? randomUUID()}`;

    // Сначала проводка по балансу (идемпотентна по ключу). Запись Deposit и уведомления —
    // только если операция реально применена, иначе повтор создал бы дубль истории/спама.
    const { client: updated, applied } = await this.balance.deposit(target.id, amount, key);
    if (!applied) {
      const [last] = await this.deposits.findByClient(target.id);
      return {
        deposit: last ? new DepositResponseDto(last) : null,
        balance: updated.balance.toString(),
      };
    }

    const deposit = await this.deposits.create({
      clientId: target.id,
      amount,
      adminTelegramId: admin.telegramId,
    });
    await this.notifyBalanceChange(target, amount, updated, 'deposit');

    return { deposit: new DepositResponseDto(deposit), balance: updated.balance.toString() };
  }

  /** Ручное списание с баланса админом (коррекция). Только ledger-проводка, не Deposit. */
  @Transactional()
  async adminWithdraw(dto: CreateDepositDto): Promise<{ balance: string }> {
    const target = await this.clients.findById(dto.clientId);
    if (!target) {
      throw new NotFoundError('Клиент не найден');
    }

    const amount = Money.fromMajor(dto.amount);
    // Ключ в пространстве «debit:» — не пересекается с ключами пополнений/заказов.
    const key = `debit:${dto.idempotencyKey ?? randomUUID()}`;

    const { client: updated, applied } = await this.balance.adminDebit(target.id, amount, key);
    if (applied) {
      await this.notifyBalanceChange(target, amount, updated, 'debit');
    }

    return { balance: updated.balance.toString() };
  }

  /** Уведомить клиента и админ-группу об изменении баланса (общее для пополнения/списания). */
  private async notifyBalanceChange(
    target: Client,
    amount: Money,
    updated: Client,
    direction: 'deposit' | 'debit',
  ): Promise<void> {
    const amt = amount.toString();
    const bal = updated.balance.toString();
    const userMsg =
      direction === 'deposit'
        ? `Ваш баланс пополнен на ${amt}. Текущий баланс: ${bal}.`
        : `С вашего баланса списано ${amt}. Текущий баланс: ${bal}.`;
    const adminMsg =
      direction === 'deposit'
        ? `Пополнение: ${target.name} (+${amt}). Баланс: ${bal}.`
        : `Списание: ${target.name} (−${amt}). Баланс: ${bal}.`;

    if (target.telegramId) {
      await this.notifier?.notifyUser(target.telegramId, userMsg);
    }
    await this.notifier?.notifyGroup(NotifyGroup.Admins, adminMsg);
  }

  /** История пополнений текущего клиента. */
  async myHistory(): Promise<DepositResponseDto[]> {
    const actor = this.actorCtx.getOrThrow();
    return this.historyFor(actor.userId);
  }

  /** История пополнений конкретного клиента (админ). */
  async historyFor(clientId: string): Promise<DepositResponseDto[]> {
    const list = await this.deposits.findByClient(clientId);
    return list.map((d) => new DepositResponseDto(d));
  }
}
