'use client';

import { useEffect, useState } from 'react';
import {
  useBusinessSettings,
  useSaveBusinessSettings,
  useSetBotToken,
  useRemoveBotToken,
  useReconnectBot,
  useBusinessChats,
  useResetChatBindings,
} from '@/lib/backoffice-queries';
import { ApiError } from '@/lib/api';
import { useT } from '@/lib/i18n';
import Link from 'next/link';

type BotFeedback = { type: 'success' | 'error'; message: string };

const BIND_COMMANDS = [
  { kind: 'cook', cmd: '/bind cook', labelKey: 'bo_bind_cmd_cook' as const },
  { kind: 'courier', cmd: '/bind courier', labelKey: 'bo_bind_cmd_courier' as const },
  { kind: 'admin', cmd: '/bind admin', labelKey: 'bo_bind_cmd_admin' as const },
];

function mutationErrorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

export function BackofficeSettings() {
  const t = useT();
  const { data: settings } = useBusinessSettings();
  const save = useSaveBusinessSettings();
  const setBot = useSetBotToken();
  const removeBot = useRemoveBotToken();
  const reconnectBot = useReconnectBot();
  const resetChats = useResetChatBindings();
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
  const [showReplaceToken, setShowReplaceToken] = useState(false);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  const [botFeedback, setBotFeedback] = useState<BotFeedback | null>(null);

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

  const handleConnect = async () => {
    const trimmed = token.trim();
    if (!trimmed) return;
    const wasReplace = showReplaceToken;
    setBotFeedback(null);
    try {
      await setBot.mutateAsync(trimmed);
      setToken('');
      setShowReplaceToken(false);
      setBotFeedback({
        type: 'success',
        message: wasReplace ? t('bo_bot_replaced_ok') : t('bo_bot_connected_ok'),
      });
    } catch (err) {
      setBotFeedback({ type: 'error', message: mutationErrorMessage(err, t('error_generic')) });
    }
  };

  const handleReconnect = async () => {
    setBotFeedback(null);
    try {
      await reconnectBot.mutateAsync();
      setBotFeedback({ type: 'success', message: t('bo_bot_reconnected_ok') });
    } catch (err) {
      setBotFeedback({ type: 'error', message: mutationErrorMessage(err, t('error_generic')) });
    }
  };

  const handleDisconnect = async () => {
    setBotFeedback(null);
    try {
      await removeBot.mutateAsync();
      setShowDisconnectConfirm(false);
      setShowReplaceToken(false);
      setToken('');
      setBotFeedback({ type: 'success', message: t('bo_bot_disconnected_ok') });
    } catch (err) {
      setBotFeedback({ type: 'error', message: mutationErrorMessage(err, t('error_generic')) });
    }
  };

  const handleResetChats = async () => {
    setBotFeedback(null);
    try {
      await resetChats.mutateAsync();
      setBotFeedback({ type: 'success', message: t('bo_reset_chats_ok') });
    } catch (err) {
      setBotFeedback({ type: 'error', message: mutationErrorMessage(err, t('error_generic')) });
    }
  };

  const chatStatusLabel = (kind: string) => {
    const row = chats?.find((c) => c.kind === kind);
    if (!row?.chatId) return t('bo_chat_unbound');
    if (row.status === 'active') return t('bo_chat_active');
    return t('bo_chat_broken');
  };

  const botBusy = setBot.isPending || removeBot.isPending || reconnectBot.isPending || resetChats.isPending;

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

      {botFeedback && (
        <div
          className="adm-banner"
          style={{
            marginBottom: 16,
            borderColor: botFeedback.type === 'error' ? 'var(--danger, #e74c3c)' : 'var(--accent)',
            color: botFeedback.type === 'error' ? 'var(--danger, #e74c3c)' : undefined,
          }}
        >
          <span>{botFeedback.message}</span>
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
            <button className="btn btn-primary" disabled={botBusy} onClick={() => void handleReconnect()}>
              {t('bo_reconnect_bot')}
            </button>
            {!showReplaceToken && (
              <button className="btn" disabled={botBusy} onClick={() => setShowReplaceToken(true)}>
                {t('bo_replace_bot')}
              </button>
            )}
            {!showDisconnectConfirm && (
              <button className="btn" disabled={botBusy} onClick={() => setShowDisconnectConfirm(true)}>
                {t('bo_disconnect_bot')}
              </button>
            )}
          </div>

          {showReplaceToken && (
            <div className="field" style={{ marginTop: 12 }}>
              <label>{t('bo_bot_token')}</label>
              <p className="muted" style={{ fontSize: 13, marginBottom: 8 }}>
                {t('bo_replace_bot_hint')}
              </p>
              <input
                className="input"
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
              />
              <div className="seg" style={{ marginTop: 8 }}>
                <button
                  className="btn btn-primary"
                  disabled={!token.trim() || botBusy}
                  onClick={() => void handleConnect()}
                >
                  {t('bo_replace_bot')}
                </button>
                <button
                  className="btn"
                  disabled={botBusy}
                  onClick={() => {
                    setShowReplaceToken(false);
                    setToken('');
                  }}
                >
                  {t('act_cancel')}
                </button>
              </div>
            </div>
          )}

          {showDisconnectConfirm && (
            <div className="card" style={{ marginTop: 12, background: 'var(--surface-2, rgba(0,0,0,0.03))' }}>
              <p style={{ marginBottom: 8 }}>{t('bo_disconnect_confirm')}</p>
              <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
                {t('bo_disconnect_confirm_hint')}
              </p>
              <div className="seg">
                <button className="btn" disabled={botBusy} onClick={() => void handleDisconnect()}>
                  {t('bo_disconnect_confirm_yes')}
                </button>
                <button className="btn btn-primary" disabled={botBusy} onClick={() => setShowDisconnectConfirm(false)}>
                  {t('bo_cancel_confirm_no')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {!settings?.hasBotToken && (
        <div className="field" style={{ marginBottom: 16 }}>
          <label>{t('bo_bot_token')}</label>
          <p className="muted" style={{ fontSize: 13, marginBottom: 8 }}>
            {t('bo_token_hint')}
          </p>
          <input
            className="input"
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
          <button
            className="btn btn-primary"
            style={{ marginTop: 8 }}
            disabled={!token.trim() || botBusy}
            onClick={() => void handleConnect()}
          >
            {t('bo_connect_bot')}
          </button>
        </div>
      )}

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>{t('bo_chats')}</h3>
        <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
          {t('bo_reset_chats_hint')}
        </p>
        {BIND_COMMANDS.map(({ kind, cmd, labelKey }) => {
          const row = chats?.find((c) => c.kind === kind);
          const active = row?.chatId && row.status === 'active';
          return (
            <div key={kind} className="row" style={{ marginBottom: 8, alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div>{t(labelKey)}</div>
                <code style={{ fontSize: 12 }}>{cmd}</code>
              </div>
              <span className="muted" style={{ textAlign: 'right', fontSize: 13 }}>
                {active ? `✅ ${row?.title ?? row?.chatId}` : chatStatusLabel(kind)}
              </span>
            </div>
          );
        })}
        {settings?.hasBotToken && (
          <div className="seg" style={{ marginTop: 12 }}>
            <button
              className="btn"
              disabled={botBusy}
              onClick={() => void handleResetChats()}
            >
              {t('bo_reset_chats')}
            </button>
            <Link href="/b/onboarding/" className="btn btn-primary">
              {t('bo_onboarding_continue')}
            </Link>
          </div>
        )}
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
