'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthStore } from '@/store/auth.store';
import { useUpdateProfile } from '@/lib/queries';
import { useT } from '@/lib/i18n';

const schema = z.object({
  name: z.string().trim().min(1),
  phone: z.string().trim().min(5),
  address: z.string().trim().min(3),
});
type FormValues = z.infer<typeof schema>;

/** Гейт регистрации (FR-F3): незаполненный профиль (нет телефона/адреса) → форма. */
export function RegistrationForm() {
  const t = useT();
  const client = useAuthStore((s) => s.client)!;
  const update = useUpdateProfile();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: client.name, phone: client.phone ?? '', address: client.address ?? '' },
  });

  return (
    <div className="screen">
      <h2>{t('register_title')}</h2>
      <p className="muted" style={{ marginBottom: 16 }}>
        {t('register_hint')}
      </p>
      <form onSubmit={handleSubmit((data) => update.mutate(data))}>
        <div className="field">
          <label>{t('name')}</label>
          <input className="input" {...register('name')} />
          {errors.name && <div className="err">{t('required')}</div>}
        </div>
        <div className="field">
          <label>{t('phone')}</label>
          <input className="input" inputMode="tel" {...register('phone')} />
          {errors.phone && <div className="err">{t('required')}</div>}
        </div>
        <div className="field">
          <label>{t('address')}</label>
          <input className="input" {...register('address')} />
          {errors.address && <div className="err">{t('required')}</div>}
        </div>
        <button className="btn btn-primary btn-block" disabled={update.isPending}>
          {t('save')}
        </button>
      </form>
    </div>
  );
}
