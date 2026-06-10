import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { OrderStatus, PaymentMethod } from '@eatfit/shared';
import { Money } from '../common/money/money';
import { INotifier, NOTIFIER, NotifyGroup } from '../common/notifications/notifier';
import { ReportsRepository } from './reports.repository';

/** Границы «сегодня» в локальной TZ (UTC+offset), выраженные в UTC. */
interface DayRange {
  start: Date;
  end: Date;
  label: string;
}

/**
 * Итоги дня (FR-R, AR-12): текст-сводка по заказам/выручке/топу блюд/пополнениям/клиентам.
 * Шлётся в админ-группу по расписанию (DAILY_REPORT_HOUR в TZ_OFFSET_HOURS) и по требованию
 * из бота. Планировщик — @nestjs/schedule (динамический CronJob, т.к. время из конфига).
 */
@Injectable()
export class ReportsService implements OnModuleInit {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly repo: ReportsRepository,
    private readonly scheduler: SchedulerRegistry,
    @Inject(NOTIFIER) private readonly notifier: INotifier,
  ) {}

  onModuleInit(): void {
    // Cron держит тот же инстанс, что владеет ботом (иначе реплики дублировали бы отчёт).
    if (this.config.get<boolean>('bot.enabled') === false) return;

    const offset = this.config.get<number>('reports.tzOffsetHours') ?? 5;
    const hour = this.config.get<number>('reports.dailyReportHour') ?? 19;
    const utcHour = (((hour - offset) % 24) + 24) % 24;

    const job = new CronJob(
      `0 0 ${utcHour} * * *`,
      () => void this.sendDailyReportToAdmins(),
      null,
      true,
      'UTC',
    );
    this.scheduler.addCronJob('daily-report', job);
    this.logger.log(`Планировщик итогов дня: ${hour}:00 (UTC+${offset}) = ${utcHour}:00 UTC`);
  }

  /** Отправить отчёт за сегодня в админ-группу. */
  async sendDailyReportToAdmins(): Promise<void> {
    const text = await this.buildDailyReportText();
    await this.notifier.notifyGroup(NotifyGroup.Admins, text);
    this.logger.log('Итоги дня отправлены в админ-группу');
  }

  /** Текст отчёта за сегодня (HTML). */
  async buildDailyReportText(): Promise<string> {
    const offset = this.config.get<number>('reports.tzOffsetHours') ?? 5;
    const { start, end, label } = this.dayRange(offset);

    const orders = await this.repo.ordersInRange(start, end);
    const done = orders.filter((o) => o.status === OrderStatus.Done);
    const cancelled = orders.filter((o) => o.status === OrderStatus.Cancelled);
    const active = orders.filter(
      (o) => o.status !== OrderStatus.Done && o.status !== OrderStatus.Cancelled,
    );

    let revenue = Money.zero();
    let fromBalance = Money.zero();
    for (const o of done) {
      revenue = revenue.add(o.total);
      if (o.paymentMethod === PaymentMethod.Balance) fromBalance = fromBalance.add(o.total);
    }
    const avg = done.length ? Number(revenue.toString()) / done.length : 0;

    const items = await this.repo.doneItemsInRange(start, end);
    const byDish = new Map<string, number>();
    for (const it of items) {
      const name = it.menuItem?.nameRu ?? '—';
      byDish.set(name, (byDish.get(name) ?? 0) + it.quantity);
    }
    const top = [...byDish.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

    const deposits = await this.repo.depositsInRange(start, end);
    let depSum = Money.zero();
    for (const d of deposits) depSum = depSum.add(d.amount);
    const newClients = await this.repo.clientsCountInRange(start, end);

    const lines = [
      `📊 <b>Итоги дня — ${esc(label)}</b>`,
      '─────────────────',
      `🧾 Заказов всего: <b>${orders.length}</b>`,
      `✅ Доставлено: ${done.length}`,
      `⏳ В процессе: ${active.length}`,
      `❌ Отменено: ${cancelled.length}`,
      '─────────────────',
      `💰 Выручка (доставлено): <b>${esc(money(revenue))} сум</b>`,
      `💳 Из них с баланса: ${esc(money(fromBalance))} сум`,
      `🧮 Средний чек: ${esc(formatMoney(avg))} сум`,
      '─────────────────',
    ];
    if (top.length) {
      lines.push('🏆 Топ блюд:');
      top.forEach(([name, qty], i) => lines.push(`${i + 1}. ${esc(name)} — ${qty}`));
    } else {
      lines.push('🏆 Топ блюд: —');
    }
    lines.push('─────────────────');
    lines.push(`➕ Пополнений: ${deposits.length} на ${esc(money(depSum))} сум`);
    lines.push(`👥 Новых клиентов: ${newClients}`);

    return lines.join('\n');
  }

  /** Границы «сегодня» в TZ UTC+offset, выраженные в UTC, + метка DD.MM.YYYY. */
  private dayRange(offsetHours: number): DayRange {
    const localMs = Date.now() + offsetHours * 3_600_000;
    const d = new Date(localMs);
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth();
    const day = d.getUTCDate();
    const startUtcMs = Date.UTC(y, m, day) - offsetHours * 3_600_000;
    const label = `${String(day).padStart(2, '0')}.${String(m + 1).padStart(2, '0')}.${y}`;
    return {
      start: new Date(startUtcMs),
      end: new Date(startUtcMs + 24 * 3_600_000),
      label,
    };
  }
}

// — локальные форматтеры (reports не зависит от telegram-слоя) —
function money(m: Money): string {
  return formatMoney(m.toString());
}
function formatMoney(amount: number | string): string {
  const n = Math.round(Number(amount) || 0);
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}
function esc(s: unknown): string {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
