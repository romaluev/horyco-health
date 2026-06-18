'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
} from 'recharts';
import { useAnalytics, type AnalyticsDto } from '@/lib/backoffice-queries';
import { useT, useStatusText, type I18nKey } from '@/lib/i18n';
import { formatMoney } from '@/lib/format';
import { OrderStatus } from '@eatfit/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { DashboardPageHeader } from '@/components/admin/ui';
import { cn } from '@/lib/utils';

type Range = 'today' | '7d' | '30d';

function paymentMethodKey(method: string): I18nKey | null {
  switch (method) {
    case 'balance':
      return 'pay_method_balance';
    case 'on_delivery':
      return 'pay_method_on_delivery';
    default:
      return null;
  }
}

function deltaPct(current: number, prior: number): string | null {
  if (prior <= 0) return null;
  const pct = Math.round(((current - prior) / prior) * 100);
  if (pct === 0) return '0%';
  return `${pct > 0 ? '+' : ''}${pct}%`;
}

function KpiCard({
  title,
  value,
  sub,
  delta,
}: {
  title: string;
  value: string;
  sub?: string;
  delta?: string | null;
}) {
  return (
    <Card className="h-full">
      <CardContent className="pt-4">
        <p className="text-xs text-muted-foreground">{title}</p>
        <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
        {sub ? <p className="mt-1 text-xs text-muted-foreground">{sub}</p> : null}
        {delta ? (
          <p
            className={cn(
              'mt-1 text-xs font-medium',
              delta.startsWith('+')
                ? 'text-emerald-600'
                : delta.startsWith('-')
                  ? 'text-destructive'
                  : 'text-muted-foreground',
            )}
          >
            {delta}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function DashboardBody({ data }: { data: AnalyticsDto }) {
  const t = useT();
  const st = useStatusText();
  const prior = data.priorPeriod;

  const revDelta = prior ? deltaPct(Number(data.totalRevenue), Number(prior.totalRevenue)) : null;
  const ordersDelta = prior ? deltaPct(data.orderCount, prior.orderCount) : null;

  const trendData = data.revenueByDay.map((d) => ({
    date: d.date.slice(5),
    revenue: Number(d.amount),
    orders: d.orders,
  }));

  const statusData = data.ordersByStatus.map((s) => ({
    name: st(s.status as OrderStatus),
    count: s.count,
  }));

  const topData = data.topItems.slice(0, 5).map((i) => ({
    name: i.name.length > 16 ? `${i.name.slice(0, 16)}…` : i.name,
    revenue: Number(i.revenue),
    qty: i.quantity,
  }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <KpiCard
          title={t('dash_revenue')}
          value={`${formatMoney(data.totalRevenue)} ${t('currency')}`}
          delta={revDelta ? `${revDelta} ${t('dash_vs_prior')}` : undefined}
        />
        <KpiCard
          title={t('dash_aov')}
          value={`${formatMoney(data.averageOrderValue)} ${t('currency')}`}
        />
        <KpiCard
          title={t('dash_orders')}
          value={String(data.orderCount)}
          sub={`${data.deliveredCount} ${t('dash_delivered')}`}
          delta={ordersDelta ? `${ordersDelta} ${t('dash_vs_prior')}` : undefined}
        />
        <KpiCard
          title={t('dash_new')}
          value={String(data.customers.newCustomers)}
          sub={`${data.customers.repeatCustomers} ${t('dash_repeat')}`}
        />
      </div>

      {trendData.length > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('dash_revenue_trend')}</CardTitle>
          </CardHeader>
          <CardContent className="h-56 md:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} width={48} />
                <Tooltip
                  formatter={(v) => [`${formatMoney(String(Number(v ?? 0)))} ${t('currency')}`, t('dash_revenue')]}
                />
                <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('dash_by_status')}</CardTitle>
          </CardHeader>
          <CardContent className="h-48 md:h-52">
            {statusData.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('dash_no_data')}</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusData} layout="vertical">
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" width={88} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={4} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('dash_top_items')}</CardTitle>
          </CardHeader>
          <CardContent className="h-48 md:h-52">
            {topData.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('dash_no_data')}</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={50} />
                  <YAxis tick={{ fontSize: 11 }} width={40} />
                  <Tooltip
                    formatter={(v) => [`${formatMoney(String(Number(v ?? 0)))} ${t('currency')}`, t('dash_revenue')]}
                  />
                  <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={4} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('dash_by_payment')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {data.revenueByPayment.length === 0 ? (
              <p className="text-muted-foreground">{t('dash_no_data')}</p>
            ) : (
              data.revenueByPayment.map((r) => {
                const key = paymentMethodKey(r.method);
                return (
                  <div key={r.method} className="flex justify-between gap-2">
                    <span>{key ? t(key) : r.method}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {formatMoney(r.amount)} · {r.orders}
                    </span>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('dash_offer_funnel')}</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-2 text-center text-sm">
            <div>
              <p className="text-2xl font-bold tabular-nums">{data.offerFunnel.sent}</p>
              <p className="text-muted-foreground">{t('dash_funnel_sent')}</p>
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{data.offerFunnel.opened}</p>
              <p className="text-muted-foreground">{t('dash_funnel_opened')}</p>
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{data.offerFunnel.ordered}</p>
              <p className="text-muted-foreground">{t('dash_funnel_ordered')}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link href="/b/orders/" className="text-sm text-primary underline-offset-4 hover:underline">
          {t('adm_orders')} →
        </Link>
        <Link href="/b/customers/" className="text-sm text-primary underline-offset-4 hover:underline">
          {t('adm_users')} →
        </Link>
        <Link href="/b/offers/" className="text-sm text-primary underline-offset-4 hover:underline">
          {t('bo_offers')} →
        </Link>
      </div>
    </div>
  );
}

export function DashboardTab() {
  const t = useT();
  const [range, setRange] = useState<Range>('today');
  const { data, isLoading } = useAnalytics(range);

  const rangeTabs = (
    <Tabs value={range} onValueChange={(v) => setRange(v as Range)}>
      <TabsList>
        {(['today', '7d', '30d'] as const).map((r) => (
          <TabsTrigger key={r} value={r}>
            {t(r === 'today' ? 'dash_range_today' : r === '7d' ? 'dash_range_7d' : 'dash_range_30d')}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );

  return (
    <div className="space-y-4">
      <DashboardPageHeader
        title={t('dash_title')}
        description={data?.label}
        actions={rangeTabs}
      />

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="col-span-2 h-56 md:col-span-full" />
        </div>
      ) : null}

      {data ? <DashboardBody data={data} /> : null}
    </div>
  );
}
