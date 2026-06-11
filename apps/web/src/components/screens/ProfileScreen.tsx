'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Language } from '@eatfit/shared';
import { useAuthStore } from '@/store/auth.store';
import { useUpdateProfile } from '@/lib/queries';
import { useT } from '@/lib/i18n';
import { formatMoney } from '@/lib/format';

const schema = z.object({
  name: z.string().trim().min(1),
  phone: z.string().trim().min(5),
  address: z.string().trim().min(3),
});
type FormValues = z.infer<typeof schema>;

export function ProfileScreen() {
  const t = useT();
  const client = useAuthStore((s) => s.client)!;
  const update = useUpdateProfile();
  const [saved, setSaved] = useState(false);
  const [password, setPassword] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: client.name, phone: client.phone ?? '', address: client.address ?? '' },
  });

  const onSubmit = (data: FormValues) => {
    const body = password.trim().length >= 6 ? { ...data, password: password.trim() } : data;
    update.mutate(body, {
      onSuccess: () => {
        setSaved(true);
        if (password.trim().length >= 6) setPassword('');
        setTimeout(() => setSaved(false), 1500);
      },
    });
  };

  return (
    <div>
      <h2>{t('nav_profile')}</h2>

      <div className="card">
        <div className="row">
          <span className="muted">{t('balance')}</span>
          <strong>
            {formatMoney(client.balance)} {t('currency')}
          </strong>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="field">
          <label>{t('name')}</label>
          <input className="input" {...register('name')} />
          {errors.name && <div className="err" role="alert">{t('required')}</div>}
        </div>
        <div className="field">
          <label>{t('phone')}</label>
          <input className="input" inputMode="tel" {...register('phone')} />
          {errors.phone && <div className="err" role="alert">{t('required')}</div>}
        </div>
        <div className="field">
          <label>{t('address')}</label>
          <input className="input" {...register('address')} />
          {errors.address && <div className="err" role="alert">{t('required')}</div>}
        </div>

        <div className="field">
          <label>{t('profile_password')}</label>
          <input
            className="input"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t('web_password_hint')}
          />
          <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
            {t('profile_password_hint')}
          </p>
        </div>

        <div className="field">
          <label>{t('language')}</label>
          <div className="seg">
            <button
              type="button"
              className={client.language === Language.Ru ? 'active' : ''}
              onClick={() => update.mutate({ language: Language.Ru })}
            >
              Русский
            </button>
            <button
              type="button"
              className={client.language === Language.Uz ? 'active' : ''}
              onClick={() => update.mutate({ language: Language.Uz })}
            >
              O&apos;zbek
            </button>
          </div>
        </div>

        <button className="btn btn-primary btn-block" disabled={update.isPending}>
          {saved ? t('saved') : t('save')}
        </button>
      </form>
    </div>
  );
}
