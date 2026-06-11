'use client';

import { useEffect, useState } from 'react';
import { MemberRole } from '@eatfit/shared';
import {
  useBusinessSettings,
  useSaveBusinessSettings,
  useSetBotToken,
  useRemoveBotToken,
  useReconnectBot,
  useStaffList,
  useInviteStaff,
  useRemoveStaff,
  useBusinessChats,
} from '@/lib/backoffice-queries';
import { useT } from '@/lib/i18n';
import { OnboardingWizard } from './OnboardingWizard';

export function BackofficeSettings() {
  const t = useT();
  const { data: settings } = useBusinessSettings();
  const save = useSaveBusinessSettings();
  const setBot = useSetBotToken();
  const removeBot = useRemoveBotToken();
  const reconnectBot = useReconnectBot();
  const { data: staff } = useStaffList();
  const invite = useInviteStaff();
  const remove = useRemoveStaff();
  const { data: chats } = useBusinessChats();

  const [form, setForm] = useState({
    topupTelegram: '',
    topupPhone: '',
    supportContact: '',
    tzOffsetHours: 5,
    dailyReportHour: 19,
  });
  const [token, setToken] = useState('');
  const [inviteForm, setInviteForm] = useState({ name: '', phone: '', role: MemberRole.Cook });

  useEffect(() => {
    if (settings) {
      setForm({
        topupTelegram: settings.topupTelegram ?? '',
        topupPhone: settings.topupPhone ?? '',
        supportContact: settings.supportContact ?? '',
        tzOffsetHours: settings.tzOffsetHours,
        dailyReportHour: settings.dailyReportHour,
      });
    }
  }, [settings]);

  const showWizard = settings && !settings.hasBotToken;

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
      {showWizard && <OnboardingWizard />}

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

      {!showWizard && !settings?.hasBotToken && (
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

      <h3 style={{ marginTop: 24 }}>{t('bo_staff')}</h3>
      {staff?.map((m) => (
        <div className="card" key={m.id} style={{ marginBottom: 8 }}>
          <div className="row">
            <div>
              <strong>{m.name}</strong>
              <div className="muted">
                {m.role} · {m.status}
              </div>
              {m.inviteLink && (
                <a href={m.inviteLink} target="_blank" rel="noreferrer" style={{ fontSize: 13 }}>
                  {t('bo_invite_link')}
                </a>
              )}
            </div>
            {m.role !== 'owner' && (
              <button className="btn" onClick={() => remove.mutate(m.id)}>
                {t('adm_delete')}
              </button>
            )}
          </div>
        </div>
      ))}
      <div className="card">
        <div className="field">
          <label>{t('name')}</label>
          <input
            className="input"
            value={inviteForm.name}
            onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })}
          />
        </div>
        <div className="field">
          <label>{t('phone')}</label>
          <input
            className="input"
            value={inviteForm.phone}
            onChange={(e) => setInviteForm({ ...inviteForm, phone: e.target.value })}
          />
        </div>
        <div className="field">
          <label>{t('adm_role')}</label>
          <select
            className="input"
            value={inviteForm.role}
            onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value as MemberRole })}
          >
            <option value={MemberRole.Manager}>manager</option>
            <option value={MemberRole.Cook}>cook</option>
            <option value={MemberRole.Courier}>courier</option>
          </select>
        </div>
        <button
          className="btn btn-primary"
          disabled={invite.isPending}
          onClick={() => invite.mutate(inviteForm)}
        >
          {t('bo_invite')}
        </button>
      </div>
    </div>
  );
}
