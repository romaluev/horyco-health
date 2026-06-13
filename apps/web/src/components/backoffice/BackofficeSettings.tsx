'use client';

import { useEffect, useState } from 'react';
import {
  useBusinessSettings,
  useSaveBusinessSettings,
  useSetBotToken,
  useRemoveBotToken,
  useReconnectBot,
  useBusinessChats,
} from '@/lib/backoffice-queries';
import { useT } from '@/lib/i18n';
import Link from 'next/link';

export function BackofficeSettings() {
  const t = useT();
  const { data: settings } = useBusinessSettings();
  const save = useSaveBusinessSettings();
  const setBot = useSetBotToken();
  const removeBot = useRemoveBotToken();
  const reconnectBot = useReconnectBot();
  const { data: chats } = useBusinessChats();

  const [form, setForm] = useState({
    topupTelegram: '',
    topupPhone: '',
    supportContact: '',
    tzOffsetHours: 5,
    dailyReportHour: 19,
    welcomeMessageRu: '',
    welcomeMessageUz: '',
  });
  const [token, setToken] = useState('');

  useEffect(() => {
    if (settings) {
      setForm({
        topupTelegram: settings.topupTelegram ?? '',
        topupPhone: settings.topupPhone ?? '',
        supportContact: settings.supportContact ?? '',
        tzOffsetHours: settings.tzOffsetHours,
        dailyReportHour: settings.dailyReportHour,
        welcomeMessageRu: settings.welcomeMessageRu ?? '',
        welcomeMessageUz: settings.welcomeMessageUz ?? '',
      });
    }
  }, [settings]);

  const showWizardLink = settings && settings.status === 'onboarding';

  const botStatusLabel = (status: string) => {
    switch (status) {
      case 'webhook':
        return t('bo_bot_status_webhook');
      case 'polling':
        return t('bo_bot_status_polling');
      case 'error':
      case 'revoked':
        return t('bo_bot_status_error');
      default:
        return t('bo_bot_status_off');
    }
  };

  const botStatusColor = (status: string) => {
    if (status === 'webhook' || status === 'polling') return 'var(--accent)';
    return 'var(--danger, #e74c3c)';
  };

  return (
    <div>
      {showWizardLink && (
        <div className="adm-banner" style={{ marginBottom: 16 }}>
          <span>{t('bo_onboarding_banner')}</span>
          <Link href="/b/onboarding/" className="adm-btn adm-btn-sm adm-btn-primary">
            {t('bo_onboarding_continue')}
          </Link>
        </div>
      )}

      {settings?.hasBotToken && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="row">
            <span>@{settings.botUsername ?? '—'}</span>
            <span style={{ color: botStatusColor(settings.botStatus), fontWeight: 600 }}>
              {botStatusLabel(settings.botStatus)}
            </span>
          </div>
          <div className="seg" style={{ marginTop: 8 }}>
            <button
              className="btn btn-primary"
              disabled={reconnectBot.isPending}
              onClick={() => reconnectBot.mutate()}
            >
              {t('bo_reconnect_bot')}
            </button>
            <button className="btn" disabled={removeBot.isPending} onClick={() => removeBot.mutate()}>
              {t('bo_disconnect_bot')}
            </button>
          </div>
        </div>
      )}

      {!settings?.hasBotToken && (
        <div className="field">
          <label>{t('bo_bot_token')}</label>
          <input
            className="input"
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
          <button
            className="btn btn-primary"
            style={{ marginTop: 8 }}
            disabled={!token.trim() || setBot.isPending}
            onClick={() => setBot.mutate(token.trim())}
          >
            {t('bo_connect_bot')}
          </button>
        </div>
      )}

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>{t('bo_chats')}</h3>
        {chats?.map((c) => (
          <div key={c.kind} className="row" style={{ marginBottom: 6 }}>
            <span>{c.kind}</span>
            <span className="muted">{c.chatId ? `✅ ${c.title ?? c.chatId}` : '—'}</span>
          </div>
        ))}
        <p className="muted" style={{ marginTop: 8, fontSize: 13 }}>
          {t('bo_bind_hint')}
        </p>
      </div>

      <div className="field">
        <label>{t('bo_tz')}</label>
        <input
          className="input"
          type="number"
          value={form.tzOffsetHours}
          onChange={(e) => setForm({ ...form, tzOffsetHours: Number(e.target.value) })}
        />
      </div>
      <div className="field">
        <label>{t('bo_report_hour')}</label>
        <input
          className="input"
          type="number"
          min={0}
          max={23}
          value={form.dailyReportHour}
          onChange={(e) => setForm({ ...form, dailyReportHour: Number(e.target.value) })}
        />
      </div>
      <div className="field">
        <label>{t('bo_welcome_ru')}</label>
        <textarea
          className="input"
          rows={3}
          value={form.welcomeMessageRu}
          onChange={(e) => setForm({ ...form, welcomeMessageRu: e.target.value })}
        />
      </div>
      <div className="field">
        <label>{t('bo_welcome_uz')}</label>
        <textarea
          className="input"
          rows={3}
          value={form.welcomeMessageUz}
          onChange={(e) => setForm({ ...form, welcomeMessageUz: e.target.value })}
        />
        <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
          {t('bo_welcome_hint')}
        </p>
      </div>
      <div className="field">
        <label>{t('set_topup_tg')}</label>
        <input
          className="input"
          value={form.topupTelegram}
          onChange={(e) => setForm({ ...form, topupTelegram: e.target.value })}
        />
      </div>
      <div className="field">
        <label>{t('set_topup_phone')}</label>
        <input
          className="input"
          value={form.topupPhone}
          onChange={(e) => setForm({ ...form, topupPhone: e.target.value })}
        />
      </div>
      <div className="field">
        <label>{t('set_support')}</label>
        <input
          className="input"
          value={form.supportContact}
          onChange={(e) => setForm({ ...form, supportContact: e.target.value })}
        />
      </div>
      <button
        className="btn btn-primary btn-block"
        disabled={save.isPending}
        onClick={() => save.mutate(form)}
      >
        {t('save')}
      </button>

      <div className="card" style={{ marginTop: 24 }}>
        <h3>{t('bo_staff')}</h3>
        <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
          {t('bo_staff_hint')}
        </p>
        <Link href="/b/staff/" className="btn btn-primary btn-block">
          {t('bo_staff')}
        </Link>
      </div>
    </div>
  );
}
