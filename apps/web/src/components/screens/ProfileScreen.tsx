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
import { DeliveryLocationFields, hasDeliveryLocation } from '@/components/DeliveryLocationFields';

const schema = z.object({
  name: z.string().trim().min(1),
  phone: z.string().trim().min(5),
  address: z.string().trim().optional(),
  deliveryLat: z.number().nullable(),
  deliveryLng: z.number().nullable(),
}).refine((d) => hasDeliveryLocation(d), { message: 'location_required', path: ['deliveryLat'] });

type FormValues = z.infer<typeof schema>;

export function ProfileScreen() {
  const t = useT();
  const client = useAuthStore((s) => s.client)!;
  const update = useUpdateProfile();
  const [saved, setSaved] = useState(false);
  const [password, setPassword] = useState('');
  const [loc, setLoc] = useState({
    deliveryLat: client.deliveryLat ?? null,
    deliveryLng: client.deliveryLng ?? null,
    address: client.address ?? '',
  });

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: client.name,
      phone: client.phone ?? '',
      address: client.address ?? '',
      deliveryLat: client.deliveryLat ?? null,
      deliveryLng: client.deliveryLng ?? null,
    },
  });

  const syncLocation = (next: typeof loc) => {
    setLoc(next);
    setValue('deliveryLat', next.deliveryLat);
    setValue('deliveryLng', next.deliveryLng);
    setValue('address', next.address);
  };

  const onSubmit = (data: FormValues) => {
    const body = {
      name: data.name,
      phone: data.phone,
      address: data.address?.trim() || undefined,
      deliveryLat: data.deliveryLat ?? undefined,
      deliveryLng: data.deliveryLng ?? undefined,
      ...(password.trim().length >= 6 ? { password: password.trim() } : {}),
    };
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
        <DeliveryLocationFields value={loc} onChange={syncLocation} />
        {errors.deliveryLat && <div className="err" role="alert">{t('location_required')}</div>}

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
