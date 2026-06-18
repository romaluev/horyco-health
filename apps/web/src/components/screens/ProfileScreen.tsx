'use client';

import { useState } from 'react';
import { Check, Eye, EyeOff } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Language, normalizePhone } from '@eatfit/shared';
import { useAuthStore } from '@/store/auth.store';
import { useUpdateProfile } from '@/lib/queries';
import { ApiError } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { haptic } from '@/lib/telegram';
import { DeliveryLocationFields, hasDeliveryInfo } from '@/components/DeliveryLocationFields';
import { Button, PriceTag } from '@/components/consumer';

const schema = z.object({
  name: z.string().trim().min(1),
  phone: z.string().trim().min(5),
  address: z.string().trim().optional(),
  deliveryLat: z.number().nullable(),
  deliveryLng: z.number().nullable(),
}).refine((d) => hasDeliveryInfo(d), { message: 'delivery_required', path: ['deliveryLat'] });

type FormValues = z.infer<typeof schema>;

export function ProfileScreen() {
  const t = useT();
  const client = useAuthStore((s) => s.client)!;
  const update = useUpdateProfile();
  const [saved, setSaved] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loc, setLoc] = useState({
    deliveryLat: client.deliveryLat ?? null,
    deliveryLng: client.deliveryLng ?? null,
    address: client.address ?? '',
  });

  const initial = client.name.trim().charAt(0).toUpperCase() || '?';

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
      phone: normalizePhone(data.phone),
      address: data.address?.trim() || undefined,
      deliveryLat: data.deliveryLat ?? undefined,
      deliveryLng: data.deliveryLng ?? undefined,
      ...(password.trim().length >= 6 ? { password: password.trim() } : {}),
    };
    update.mutate(body, {
      onSuccess: () => {
        haptic('success');
        setSaved(true);
        if (password.trim().length >= 6) setPassword('');
        setTimeout(() => setSaved(false), 1500);
      },
    });
  };

  return (
    <div>
      <div className="profile-header">
        <div className="profile-avatar" aria-hidden>
          {initial}
        </div>
        <div>
          <h2 className="profile-name">{client.name}</h2>
          <p className="profile-sub">{client.phone ?? t('phone')}</p>
        </div>
      </div>

      <div className="balance-card">
        <div className="balance-card-label">{t('balance')}</div>
        <PriceTag amount={client.balance} className="balance-card-value" />
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="form-section">
          <div className="field">
            <label htmlFor="profile-name">{t('name')}</label>
            <input id="profile-name" className="input" autoComplete="name" {...register('name')} />
            {errors.name ? <div className="err" role="alert">{t('required')}</div> : null}
          </div>
          <div className="field">
            <label htmlFor="profile-phone">{t('phone')}</label>
            <input
              id="profile-phone"
              className="input"
              inputMode="tel"
              autoComplete="tel"
              {...register('phone')}
            />
            {errors.phone ? <div className="err" role="alert">{t('required')}</div> : null}
          </div>
          <DeliveryLocationFields value={loc} onChange={syncLocation} />
          {errors.deliveryLat ? (
            <div className="err" role="alert">{t('delivery_required')}</div>
          ) : null}
        </div>

        <div className="form-section">
          <div className="field">
            <label htmlFor="profile-password">{t('profile_password')}</label>
            <div className="password-wrap">
              <input
                id="profile-password"
                className="input"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('web_password_hint')}
              />
              <button
                type="button"
                className="password-toggle"
                aria-label={showPassword ? t('hide_password') : t('show_password')}
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <p className="muted u-hint-sm u-mt-1">{t('profile_password_hint')}</p>
          </div>

          <div className="field">
            <label>{t('language')}</label>
            <div className="seg">
              <button
                type="button"
                className={client.language === Language.Ru ? 'active' : ''}
                onClick={() => {
                  haptic('selection');
                  update.mutate({ language: Language.Ru });
                }}
              >
                Русский
              </button>
              <button
                type="button"
                className={client.language === Language.Uz ? 'active' : ''}
                onClick={() => {
                  haptic('selection');
                  update.mutate({ language: Language.Uz });
                }}
              >
                O&apos;zbek
              </button>
            </div>
          </div>
        </div>

        {update.isError ? (
          <div className="err u-mb-3" role="alert">
            {update.error instanceof ApiError ? update.error.message : t('error_generic')}
          </div>
        ) : null}

        <Button variant="primary" size="block" busy={update.isPending} type="submit">
          {saved ? (
            <span className="save-success">
              <Check size={18} aria-hidden />
              {t('saved')}
            </span>
          ) : (
            t('save')
          )}
        </Button>
      </form>
    </div>
  );
}
