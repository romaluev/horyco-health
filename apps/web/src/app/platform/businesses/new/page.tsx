'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useCreateBusiness, type CreateBusinessResult } from '@/lib/backoffice-queries';
import { slugifyName } from '@/lib/slugify';
import { useT } from '@/lib/i18n';
import { ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, FormGrid, FormSection, PageHeader } from '@/components/admin/ui';

export default function PlatformCreateBusinessPage() {
  const t = useT();
  const create = useCreateBusiness();
  const [slugTouched, setSlugTouched] = useState(false);
  const [success, setSuccess] = useState<CreateBusinessResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    slug: '',
    ownerName: '',
    ownerPhone: '',
    ownerPassword: '',
    tzOffsetHours: 5,
    dailyReportHour: 19,
  });

  const onNameChange = (name: string) => {
    setForm((f) => ({
      ...f,
      name,
      slug: slugTouched ? f.slug : slugifyName(name),
    }));
  };

  const submit = () => {
    setError(null);
    create.mutate(form, {
      onSuccess: (data) => {
        setSuccess(data);
        setForm({
          name: '',
          slug: '',
          ownerName: '',
          ownerPhone: '',
          ownerPassword: '',
          tzOffsetHours: 5,
          dailyReportHour: 19,
        });
        setSlugTouched(false);
      },
      onError: (err) => setError(err instanceof ApiError ? err.message : t('error_generic')),
    });
  };

  if (success) {
    return (
      <>
        <PageHeader title={t('platform_create_success')} />
        <FormSection title={t('platform_owner_credentials')}>
          <div className="adm-alert adm-alert-success mb-4" role="status">
            {t('platform_create_success')}: <strong>{success.business.name}</strong>
          </div>
          <p>
            {t('phone')}: <strong>{success.owner.phone}</strong>
          </p>
          {success.owner.existingAccount && (
            <p className="text-sm text-muted-foreground">{t('platform_existing_owner')}</p>
          )}
          <p>
            {t('platform_copy_login')}:{' '}
            <a href={success.loginUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">
              {success.loginUrl}
            </a>
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link href="/platform/businesses/">{t('platform_back_list')}</Link>
            </Button>
            <Button variant="default" onClick={() => setSuccess(null)}>
              {t('platform_create_btn')}
            </Button>
          </div>
        </FormSection>
      </>
    );
  }

  return (
    <>
      <PageHeader title={t('platform_create')} />
      <FormSection title={t('platform_create')}>
        {error && (
          <div className="adm-alert adm-alert-error mb-4" role="alert">
            {error}
          </div>
        )}
        <div className="space-y-4">
          <FormGrid>
            <Field label={t('platform_field_name')}>
              <Input value={form.name} onChange={(e) => onNameChange(e.target.value)} />
            </Field>
            <Field label={t('platform_field_slug')} hint={t('platform_slug_hint')}>
              <Input
                value={form.slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setForm({ ...form, slug: e.target.value });
                }}
              />
            </Field>
            <Field label={t('platform_field_owner_name')}>
              <Input value={form.ownerName} onChange={(e) => setForm({ ...form, ownerName: e.target.value })} />
            </Field>
            <Field label={t('platform_field_owner_phone')}>
              <Input
                inputMode="tel"
                value={form.ownerPhone}
                onChange={(e) => setForm({ ...form, ownerPhone: e.target.value })}
              />
            </Field>
            <Field label={t('platform_field_owner_password')}>
              <Input
                type="password"
                value={form.ownerPassword}
                onChange={(e) => setForm({ ...form, ownerPassword: e.target.value })}
              />
            </Field>
            <Field label={t('platform_field_tz')}>
              <Input
                type="number"
                value={form.tzOffsetHours}
                onChange={(e) => setForm({ ...form, tzOffsetHours: Number(e.target.value) })}
              />
            </Field>
            <Field label={t('platform_field_report')}>
              <Input
                type="number"
                min={0}
                max={23}
                value={form.dailyReportHour}
                onChange={(e) => setForm({ ...form, dailyReportHour: Number(e.target.value) })}
              />
            </Field>
          </FormGrid>
          <Button variant="default" disabled={create.isPending} onClick={submit}>
            {t('platform_create_btn')}
          </Button>
        </div>
      </FormSection>
    </>
  );
}
