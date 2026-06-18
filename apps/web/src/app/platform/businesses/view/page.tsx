'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  usePlatformBusiness,
  usePlatformBusinessHealth,
  useUpdatePlatformBusiness,
} from '@/lib/backoffice-queries';
import { useT } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Field, FormGrid, FormSection, DashboardPageHeader } from '@/components/admin/ui';

function BusinessViewInner() {
  const t = useT();
  const params = useSearchParams();
  const id = params.get('id');
  const { data: business } = usePlatformBusiness(id);
  const { data: health } = usePlatformBusinessHealth(id);
  const update = useUpdatePlatformBusiness();
  const [name, setName] = useState('');
  const [tz, setTz] = useState(5);
  const [hour, setHour] = useState(19);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (business && !initialized) {
      setName(business.name);
      setInitialized(true);
    }
  }, [business, initialized]);

  if (!id) {
    return <div className="bg-destructive/10 text-destructive rounded-lg border px-3 py-2 text-sm">{t('error_generic')}</div>;
  }

  if (!business) {
    return <p className="text-muted-foreground text-sm">{t('loading')}</p>;
  }

  return (
    <>
      <DashboardPageHeader
        title={business.name}
        description={`${business.slug} · ${business.status}`}
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/platform/businesses/">{t('platform_back_list')}</Link>
          </Button>
        }
      />

      {health && (
        <FormSection title={t('platform_health')} className="mb-4">
          <p className="flex flex-wrap items-center gap-2">
            <Badge variant={health.connected ? 'default' : 'secondary'}>
              {health.botStatus}
              {health.connected ? ` (${t('platform_connected')})` : ''}
            </Badge>
            {health.botUsername ? (
              <span className="text-sm text-muted-foreground">@{health.botUsername}</span>
            ) : null}
          </p>
        </FormSection>
      )}

      <FormSection title={t('platform_edit_business')}>
        <div className="space-y-4">
          <FormGrid>
            <Field label={t('platform_field_name')}>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label={t('platform_field_tz')}>
              <Input type="number" value={tz} onChange={(e) => setTz(Number(e.target.value))} />
            </Field>
            <Field label={t('platform_field_report')}>
              <Input
                type="number"
                min={0}
                max={23}
                value={hour}
                onChange={(e) => setHour(Number(e.target.value))}
              />
            </Field>
          </FormGrid>
          <Button
            variant="default"
            disabled={update.isPending}
            onClick={() => update.mutate({ id, name, tzOffsetHours: tz, dailyReportHour: hour })}
          >
            {t('platform_save')}
          </Button>
        </div>
      </FormSection>
    </>
  );
}

export default function PlatformBusinessViewPage() {
  const t = useT();
  return (
    <Suspense fallback={<p className="text-muted-foreground text-sm">{t('loading')}</p>}>
      <BusinessViewInner />
    </Suspense>
  );
}
