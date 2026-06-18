'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthStore } from '@/store/auth.store';
import { useUpdateProfile } from '@/lib/queries';
import { useT } from '@/lib/i18n';
import { DeliveryLocationFields, hasDeliveryInfo } from '@/components/DeliveryLocationFields';

const schema = z.object({
  name: z.string().trim().min(1),
  phone: z.string().trim().min(5),
  address: z.string().trim().optional(),
  deliveryLat: z.number().nullable(),
  deliveryLng: z.number().nullable(),
}).refine((d) => hasDeliveryInfo(d), { message: 'delivery_required', path: ['deliveryLat'] });

type FormValues = z.infer<typeof schema>;

/** Гейт регистрации: телефон + точка на карте (геолокация браузера). */
export function RegistrationForm() {
  const t = useT();
  const client = useAuthStore((s) => s.client)!;
  const update = useUpdateProfile();
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

  return (
    <div className="screen">
      <h2>{t('register_title')}</h2>
      <p className="muted" style={{ marginBottom: 16 }}>
        {t('register_hint')}
      </p>
      <form
        onSubmit={handleSubmit((data) =>
          update.mutate({
            name: data.name,
            phone: data.phone,
            address: data.address?.trim() || undefined,
            deliveryLat: data.deliveryLat ?? undefined,
            deliveryLng: data.deliveryLng ?? undefined,
          }),
        )}
      >
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
        {errors.deliveryLat && <div className="err" role="alert">{t('delivery_required')}</div>}
        <button className="btn btn-primary btn-block" disabled={update.isPending}>
          {t('save')}
        </button>
      </form>
    </div>
  );
}
