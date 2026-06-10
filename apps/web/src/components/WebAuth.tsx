'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { webLogin, webRegister } from '@/lib/auth';
import { useT } from '@/lib/i18n';

/** Вход/регистрация на сайте (вне Telegram) по телефону + паролю. */
export function WebAuth() {
  const t = useT();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  return (
    <div className="app">
      <div className="screen">
        <h1 style={{ fontSize: 22, margin: '8px 0 4px' }}>{t('web_welcome')}</h1>
        <div className="seg" style={{ margin: '14px 0 20px' }}>
          <button className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>
            {t('web_login')}
          </button>
          <button className={mode === 'register' ? 'active' : ''} onClick={() => setMode('register')}>
            {t('web_register')}
          </button>
        </div>
        {mode === 'login' ? (
          <LoginForm onSwitch={() => setMode('register')} />
        ) : (
          <RegisterForm onSwitch={() => setMode('login')} />
        )}
      </div>
    </div>
  );
}

function Field({ label, err, children }: { label: string; err?: string | false; children: React.ReactNode }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
      {err && <div className="err">{err}</div>}
    </div>
  );
}

const loginSchema = z.object({ phone: z.string().trim().min(5), password: z.string().min(6) });
type LoginValues = z.infer<typeof loginSchema>;

function LoginForm({ onSwitch }: { onSwitch: () => void }) {
  const t = useT();
  const [err, setErr] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });

  const submit = async (v: LoginValues) => {
    setErr(null);
    try {
      await webLogin(v.phone, v.password);
    } catch {
      setErr(t('web_auth_failed'));
    }
  };

  return (
    <form onSubmit={handleSubmit(submit)}>
      <Field label={t('phone')} err={errors.phone && t('required')}>
        <input className="input" inputMode="tel" autoComplete="tel" {...register('phone')} />
      </Field>
      <Field label={t('web_password')} err={errors.password && t('web_password_hint')}>
        <input className="input" type="password" autoComplete="current-password" {...register('password')} />
      </Field>
      {err && <div className="err" style={{ marginBottom: 10 }}>{err}</div>}
      <button className="btn btn-primary btn-block" disabled={isSubmitting}>
        {t('web_login')}
      </button>
      <button type="button" className="btn btn-block" style={{ marginTop: 8, background: 'none' }} onClick={onSwitch}>
        {t('web_to_register')}
      </button>
    </form>
  );
}

const regSchema = z.object({
  name: z.string().trim().min(1),
  phone: z.string().trim().min(5),
  password: z.string().min(6),
  address: z.string().trim().optional(),
});
type RegValues = z.infer<typeof regSchema>;

function RegisterForm({ onSwitch }: { onSwitch: () => void }) {
  const t = useT();
  const [err, setErr] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegValues>({ resolver: zodResolver(regSchema) });

  const submit = async (v: RegValues) => {
    setErr(null);
    try {
      await webRegister(v);
    } catch {
      setErr(t('web_register_failed'));
    }
  };

  return (
    <form onSubmit={handleSubmit(submit)}>
      <Field label={t('name')} err={errors.name && t('required')}>
        <input className="input" autoComplete="name" {...register('name')} />
      </Field>
      <Field label={t('phone')} err={errors.phone && t('required')}>
        <input className="input" inputMode="tel" autoComplete="tel" {...register('phone')} />
      </Field>
      <Field label={t('web_password')} err={errors.password && t('web_password_hint')}>
        <input className="input" type="password" autoComplete="new-password" {...register('password')} />
      </Field>
      <Field label={t('address')}>
        <input className="input" {...register('address')} />
      </Field>
      {err && <div className="err" style={{ marginBottom: 10 }}>{err}</div>}
      <button className="btn btn-primary btn-block" disabled={isSubmitting}>
        {t('web_register')}
      </button>
      <button type="button" className="btn btn-block" style={{ marginTop: 8, background: 'none' }} onClick={onSwitch}>
        {t('web_to_login')}
      </button>
    </form>
  );
}
