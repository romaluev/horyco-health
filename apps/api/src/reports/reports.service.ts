import { Inject, Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { OrderStatus, PaymentMethod } from '@eatfit/shared';
import { Money } from '../common/money/money';
import { INotifier, NOTIFIER, NotifyGroup } from '../common/notifications/notifier';
import { BusinessesRepository } from '../businesses/businesses.repository';
import { AnalyticsRepository } from '../analytics/analytics.repository';
import { ReportsRepository } from './reports.repository';

/** Границы «сегодня» в локальной TZ (UTC+offset), выраженные в UTC. */
interface DayRange {
  start: Date;
  end: Date;
  label: string;
}

/**
 * Итоги дня (FR-R, AR-12): текст-сводка по заказам/выручке/топу блюд/пополнениям/клиентам.
 * Phase 4: почасовой cron проверяет daily_report_hour каждого активного бизнеса в его TZ.
 */
@Injectable()
export class ReportsService implements OnModuleInit {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private readonly repo: ReportsRepository,
    private readonly analyticsRepo: AnalyticsRepository,
    private readonly businesses: BusinessesRepository,
    private readonly scheduler: SchedulerRegistry,
    @Optional() @Inject(NOTIFIER) private readonly notifier?: INotifier,
  ) {}

  onModuleInit(): void {
    const job = new CronJob('0 0 * * * *', () => void this.tickHourlyReports(), null, true, 'UTC');
    this.scheduler.addCronJob('hourly-reports', job);
    this.logger.log('Планировщик итогов дня: почасовая проверка per-business TZ');
  }

  /** Каждый час UTC: для бизнесов, у которых сейчас dailyReportHour в локальной TZ. */
  async tickHourlyReports(): Promise<void> {
    const active = await this.businesses.findAllActive();
    const utcHour = new Date().getUTCHours();
    for (const business of active) {
      const localHour = (((utcHour + business.tzOffsetHours) % 24) + 24) % 24;
      if (localHour === business.dailyReportHour) {
        await this.sendDailyReportToAdmins(business.id);
      }
    }
  }

  /** Отправить отчёт за сегодня в админ-группу бизнеса. */
  async sendDailyReportToAdmins(businessId?: string): Promise<void> {
    if (!this.notifier) return;
    const id = businessId ?? (await this.resolveSingleBusinessId());
    const text = await this.buildDailyReportText(id);
    await this.notifier.notifyGroup(id, NotifyGroup.Admins, text);
    this.logger.log(`Итоги дня отправлены (business=${id})`);
  }

  /** Текст отчёта за сегодня (HTML) для бизнеса. */
  async buildDailyReportText(businessId?: string): Promise<string> {
    const business = businessId
      ? await this.businesses.findById(businessId)
      : await this.businesses.findFirstActive();
    if (!business) {
      throw new Error('Бизнес не найден для отчёта');
    }
    const offset = business.tzOffsetHours;
    const { start, end, label } = this.dayRange(offset);

    const orders = await this.repo.ordersInRange(business.id, start, end);
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

    const items = await this.repo.doneItemsInRange(business.id, start, end);
    const byDish = new Map<string, number>();
    for (const it of items) {
      const name = it.menuItem?.nameRu ?? '—';
      byDish.set(name, (byDish.get(name) ?? 0) + it.quantity);
    }
    const top = [...byDish.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

    const deposits = await this.repo.depositsInRange(business.id, start, end);
    let depSum = Money.zero();
    for (const d of deposits) depSum = depSum.add(d.amount);
    const newClients = await this.repo.newCustomersCountInRange(business.id, start, end);
    const offerFunnel = await this.analyticsRepo.offerFunnel(business.id, start, end);

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
    lines.push(
      `📣 Рассылки: отправлено ${offerFunnel.sent} → открыто ${offerFunnel.opened} → заказано ${offerFunnel.ordered}`,
    );

    return lines.join('\n');
  }

  private async resolveSingleBusinessId(): Promise<string> {
    const business = await this.businesses.findFirstActive();
    if (!business) throw new Error('Нет активного бизнеса для отчёта');
    return business.id;
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
