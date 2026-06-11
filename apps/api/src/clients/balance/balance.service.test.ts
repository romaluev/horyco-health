/**
 * Тесты BalanceService. Запуск в node:test без Nest — никаких реальных БД и CLS.
 *
 * Решение проблемы @Transactional:
 *   Декоратор оборачивает публичные методы в Proxy, который вызывает
 *   TransactionHost.getInstance() — статический синглтон, доступный только
 *   после регистрации ClsPluginTransactional в Nest. Вне Nest вызов публичных
 *   методов (deposit, charge …) сразу падает «TransactionHost not initialized».
 *
 *   Поэтому тесты вызывают ПРИВАТНЫЙ метод apply() через (svc as any)['apply'](),
 *   минуя проксированные обёртки. Бизнес-логика (проверка идемпотентности,
 *   нехватки средств, мультитенантная изоляция) полностью сосредоточена в apply()
 *   и тестируется в полном объёме.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { BalanceTransactionType } from '@eatfit/shared';
import { BalanceService } from './balance.service';
import { Money } from '../../common/money/money';
import { InsufficientBalanceError, NotFoundError } from '../../common/errors/domain-error';

// ─────────────────────────── Фейковые репозитории ───────────────────────────

/** Подделка ClientRepository: знает только id. */
class FakeClientRepository {
  private readonly known = new Set<string>();

  seed(id: string) {
    this.known.add(id);
    return this;
  }

  async findById(id: string) {
    return this.known.has(id) ? { id } : null;
  }

  // Заглушки, которые BalanceService не вызывает в apply(), но TypeScript требует.
  findByIdForUpdate = this.findById.bind(this);
}

/** Подделка BusinessCustomersRepository с хранением in-memory. */
class FakeBusinessCustomersRepository {
  /** Ключ: `${businessId}:${clientId}` */
  private readonly rows = new Map<string, { businessId: string; clientId: string; balance: Money }>();

  private key(businessId: string, clientId: string) {
    return `${businessId}:${clientId}`;
  }

  async findForUpdateOrCreate(businessId: string, clientId: string) {
    const k = this.key(businessId, clientId);
    if (!this.rows.has(k)) {
      this.rows.set(k, { businessId, clientId, balance: Money.zero() });
    }
    return this.rows.get(k)!;
  }

  async find(businessId: string, clientId: string) {
    return this.rows.get(this.key(businessId, clientId)) ?? null;
  }

  async save(row: { businessId: string; clientId: string; balance: Money }) {
    this.rows.set(this.key(row.businessId, row.clientId), row);
    return row;
  }
}

/** Подделка BalanceRepository: append-only массив, поиск по ключу идемпотентности. */
class FakeBalanceRepository {
  private readonly ledger: Array<{
    businessId: string;
    clientId: string;
    type: BalanceTransactionType;
    amount: Money;
    balanceAfter: Money;
    orderId: string | null;
    idempotencyKey: string | null;
  }> = [];

  async create(data: typeof this.ledger[number]) {
    this.ledger.push(data);
    return data;
  }

  async findByIdempotencyKey(businessId: string, key: string) {
    return this.ledger.find((r) => r.idempotencyKey === key && r.businessId === businessId) ?? null;
  }
}

// ─────────────────────────── Вспомогательные функции ───────────────────────────

/**
 * Напрямую вызываем приватный apply() минуя @Transactional-прокси.
 * Сигнатура соответствует BalanceService.apply().
 */
function callApply(
  svc: BalanceService,
  clientId: string,
  businessId: string,
  delta: Money,
  type: BalanceTransactionType,
  orderId: string | null,
  idempotencyKey: string | null,
) {
  return (svc as unknown as Record<string, Function>)['apply'](
    clientId, businessId, delta, type, orderId, idempotencyKey,
  ) as Promise<{ balance: Money; applied: boolean }>;
}

function deposit(svc: BalanceService, clientId: string, businessId: string, amount: Money, key: string | null = null) {
  return callApply(svc, clientId, businessId, amount, BalanceTransactionType.Deposit, null, key);
}

function charge(svc: BalanceService, clientId: string, businessId: string, amount: Money, orderId: string) {
  return callApply(
    svc, clientId, businessId,
    Money.zero().subtract(amount),
    BalanceTransactionType.OrderCharge,
    orderId,
    `charge:${orderId}`,
  );
}

// ─────────────────────────── Тесты ───────────────────────────

describe('BalanceService', () => {
  let clients: FakeClientRepository;
  let wallets: FakeBusinessCustomersRepository;
  let ledger: FakeBalanceRepository;
  let svc: BalanceService;

  const C1 = 'client-1';
  const BIZ_A = 'biz-a';
  const BIZ_B = 'biz-b';

  beforeEach(() => {
    clients = new FakeClientRepository().seed(C1);
    wallets = new FakeBusinessCustomersRepository();
    ledger = new FakeBalanceRepository();
    svc = new BalanceService(
      clients as any,
      wallets as any,
      ledger as any,
    );
  });

  // ─── (a) deposit затем charge обновляет баланс корректно ───

  it('(a) deposit then charge updates balance correctly', async () => {
    const hundred = Money.fromMajor(100);
    const forty = Money.fromMajor(40);

    const dep = await deposit(svc, C1, BIZ_A, hundred);
    assert.equal(dep.applied, true);
    assert.equal(dep.balance.toString(), '100.00');

    const chg = await charge(svc, C1, BIZ_A, forty, 'order-1');
    assert.equal(chg.applied, true);
    assert.equal(chg.balance.toString(), '60.00');
  });

  // ─── (b) списание ниже нуля бросает InsufficientBalanceError ───

  it('(b) charge below zero throws InsufficientBalanceError', async () => {
    await deposit(svc, C1, BIZ_A, Money.fromMajor(50));

    await assert.rejects(
      () => charge(svc, C1, BIZ_A, Money.fromMajor(51), 'order-2'),
      InsufficientBalanceError,
    );
  });

  // ─── (c) дублирующий ключ идемпотентности: applied:false, баланс не меняется ───

  it('(c) duplicate idempotency key returns applied:false and unchanged balance', async () => {
    const amount = Money.fromMajor(200);
    const key = `deposit:${BIZ_A}:idem-key-1`;

    const first = await deposit(svc, C1, BIZ_A, amount, key);
    assert.equal(first.applied, true);
    assert.equal(first.balance.toString(), '200.00');

    const second = await deposit(svc, C1, BIZ_A, amount, key);
    assert.equal(second.applied, false);
    // Баланс не изменился — возвращается снимок кошелька (200, не 400).
    assert.equal(second.balance.toString(), '200.00');
  });

  // ─── (d) мультитенантная изоляция ───

  it('(d) deposit into bizA does not affect bizB wallet; charge in bizB throws insufficient', async () => {
    // Пополняем кошелёк C1 у бизнеса A.
    await deposit(svc, C1, BIZ_A, Money.fromMajor(500));

    // Кошелёк C1 у бизнеса B должен оставаться нулевым.
    const balB = await svc.balanceOf(C1, BIZ_B);
    assert.equal(balB.toString(), '0.00', 'кошелёк bizB должен быть нулевым');

    // Попытка списать у bizB — должна упасть на нехватке средств.
    await assert.rejects(
      () => charge(svc, C1, BIZ_B, Money.fromMajor(1), 'order-cross-1'),
      InsufficientBalanceError,
      'списание из чужого кошелька должно вернуть InsufficientBalanceError',
    );
  });

  // ─── дополнительно: не найденный клиент бросает NotFoundError ───

  it('unknown client throws NotFoundError', async () => {
    await assert.rejects(
      () => deposit(svc, 'no-such-client', BIZ_A, Money.fromMajor(10)),
      NotFoundError,
    );
  });
});
