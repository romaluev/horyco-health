'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
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
import { cn } from '@/lib/utils';
import { PageHeader, FormSection, FormGrid, Field } from '@/components/admin/ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';

type BotFeedback = { type: 'success' | 'error'; message: string };

const BIND_COMMANDS = [
  { kind: 'cook', cmd: '/bind cook', labelKey: 'bo_bind_cmd_cook' as const },
  { kind: 'courier', cmd: '/bind courier', labelKey: 'bo_bind_cmd_courier' as const },
  { kind: 'admin', cmd: '/bind admin', labelKey: 'bo_bind_cmd_admin' as const },
  { kind: 'channel', cmd: '/bind channel', labelKey: 'bo_bind_cmd_channel' as const },
];

function mutationErrorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

function botStatusClass(status: string): string {
  if (status === 'webhook' || status === 'polling') return 'text-emerald-600';
  if (status === 'error' || status === 'revoked') return 'text-destructive';
  return 'text-muted-foreground';
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
    <div className="space-y-4">
      <PageHeader title={t('adm_settings')} />

      {showWizardLink && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-primary/10 px-4 py-3">
          <span className="text-sm">{t('bo_onboarding_banner')}</span>
          <Button size="sm" asChild>
            <Link href="/b/onboarding/">{t('bo_onboarding_continue')}</Link>
          </Button>
        </div>
      )}

      {botFeedback && (
        <div
          className={cn(
            'rounded-lg px-4 py-3 text-sm',
            botFeedback.type === 'error'
              ? 'bg-destructive/10 text-destructive'
              : 'bg-primary/10',
          )}
          role="alert"
        >
          {botFeedback.message}
        </div>
      )}

      <Tabs defaultValue="bot" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
          <TabsTrigger value="bot">{t('bo_tab_bot')}</TabsTrigger>
          <TabsTrigger value="chats">{t('bo_tab_chats')}</TabsTrigger>
          <TabsTrigger value="business">{t('bo_tab_business')}</TabsTrigger>
          <TabsTrigger value="contacts">{t('bo_tab_contacts')}</TabsTrigger>
        </TabsList>

        <TabsContent value="bot" className="space-y-4">
          {settings?.hasBotToken ? (
            <FormSection title={`@${settings.botUsername ?? '—'}`}>
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm text-muted-foreground">{t('bo_bot_token')}</span>
                  <Badge variant="outline" className={cn('font-semibold', botStatusClass(settings.botStatus))}>
                    {botStatusLabel(settings.botStatus)}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button disabled={botBusy} onClick={() => void handleReconnect()}>
                    {t('bo_reconnect_bot')}
                  </Button>
                  {!showReplaceToken && (
                    <Button variant="outline" disabled={botBusy} onClick={() => setShowReplaceToken(true)}>
                      {t('bo_replace_bot')}
                    </Button>
                  )}
                  {!showDisconnectConfirm && (
                    <Button variant="outline" disabled={botBusy} onClick={() => setShowDisconnectConfirm(true)}>
                      {t('bo_disconnect_bot')}
                    </Button>
                  )}
                </div>

                {showReplaceToken && (
                  <div className="space-y-3 rounded-lg bg-card p-4">
                    <Field label={t('bo_bot_token')} hint={t('bo_replace_bot_hint')}>
                      <Input type="password" value={token} onChange={(e) => setToken(e.target.value)} />
                    </Field>
                    <div className="flex flex-wrap gap-2">
                      <Button disabled={!token.trim() || botBusy} onClick={() => void handleConnect()}>
                        {t('bo_replace_bot')}
                      </Button>
                      <Button
                        variant="outline"
                        disabled={botBusy}
                        onClick={() => {
                          setShowReplaceToken(false);
                          setToken('');
                        }}
                      >
                        {t('act_cancel')}
                      </Button>
                    </div>
                  </div>
                )}

                {showDisconnectConfirm && (
                  <div className="space-y-3 rounded-lg bg-card p-4">
                    <p className="text-sm font-medium">{t('bo_disconnect_confirm')}</p>
                    <p className="text-sm text-muted-foreground">{t('bo_disconnect_confirm_hint')}</p>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="destructive" disabled={botBusy} onClick={() => void handleDisconnect()}>
                        {t('bo_disconnect_confirm_yes')}
                      </Button>
                      <Button disabled={botBusy} onClick={() => setShowDisconnectConfirm(false)}>
                        {t('bo_cancel_confirm_no')}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </FormSection>
          ) : (
            <FormSection title={t('bo_connect_bot')} description={t('bo_token_hint')}>
              <div className="space-y-3">
                <Field label={t('bo_bot_token')}>
                  <Input type="password" value={token} onChange={(e) => setToken(e.target.value)} />
                </Field>
                <Button disabled={!token.trim() || botBusy} onClick={() => void handleConnect()}>
                  {t('bo_connect_bot')}
                </Button>
              </div>
            </FormSection>
          )}
        </TabsContent>

        <TabsContent value="chats" className="space-y-4">
          <FormSection title={t('bo_chats')} description={t('bo_reset_chats_hint')}>
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">{t('bo_bind_channel_hint')}</p>
              <div className="divide-y divide-border/60 rounded-lg">
                {BIND_COMMANDS.map(({ kind, cmd, labelKey }) => {
                  const row = chats?.find((c) => c.kind === kind);
                  const active = row?.chatId && row.status === 'active';
                  return (
                    <div key={kind} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <div className="text-sm font-medium">{t(labelKey)}</div>
                        <code className="text-xs text-muted-foreground">{cmd}</code>
                      </div>
                      <span className="text-right text-xs text-muted-foreground">
                        {active ? `✅ ${row?.title ?? row?.chatId}` : chatStatusLabel(kind)}
                      </span>
                    </div>
                  );
                })}
              </div>
              {settings?.hasBotToken && (
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" disabled={botBusy} onClick={() => void handleResetChats()}>
                    {t('bo_reset_chats')}
                  </Button>
                  <Button asChild>
                    <Link href="/b/onboarding/">{t('bo_onboarding_continue')}</Link>
                  </Button>
                </div>
              )}
            </div>
          </FormSection>
        </TabsContent>

        <TabsContent value="business" className="space-y-4">
          <FormSection title={t('bo_tab_business')}>
            <div className="space-y-4">
              <FormGrid>
                <Field label={t('bo_tz')}>
                  <Input
                    type="number"
                    value={form.tzOffsetHours}
                    onChange={(e) => setForm({ ...form, tzOffsetHours: Number(e.target.value) })}
                  />
                </Field>
                <Field label={t('bo_report_hour')}>
                  <Input
                    type="number"
                    min={0}
                    max={23}
                    value={form.dailyReportHour}
                    onChange={(e) => setForm({ ...form, dailyReportHour: Number(e.target.value) })}
                  />
                </Field>
              </FormGrid>
              <FormGrid>
                <Field label={t('bo_welcome_ru')} hint={t('bo_welcome_hint')}>
                  <Textarea
                    rows={3}
                    value={form.welcomeMessageRu}
                    onChange={(e) => setForm({ ...form, welcomeMessageRu: e.target.value })}
                  />
                </Field>
                <Field label={t('bo_welcome_uz')}>
                  <Textarea
                    rows={3}
                    value={form.welcomeMessageUz}
                    onChange={(e) => setForm({ ...form, welcomeMessageUz: e.target.value })}
                  />
                </Field>
              </FormGrid>
              <Button className="w-full" disabled={save.isPending} onClick={() => save.mutate(form)}>
                {t('save')}
              </Button>
            </div>
          </FormSection>
        </TabsContent>

        <TabsContent value="contacts" className="space-y-4">
          <FormSection title={t('bo_tab_contacts')}>
            <div className="space-y-4">
              <FormGrid>
                <Field label={t('set_topup_tg')}>
                  <Input
                    value={form.topupTelegram}
                    onChange={(e) => setForm({ ...form, topupTelegram: e.target.value })}
                  />
                </Field>
                <Field label={t('set_topup_phone')}>
                  <Input
                    value={form.topupPhone}
                    onChange={(e) => setForm({ ...form, topupPhone: e.target.value })}
                  />
                </Field>
              </FormGrid>
              <Field label={t('set_support')}>
                <Input
                  value={form.supportContact}
                  onChange={(e) => setForm({ ...form, supportContact: e.target.value })}
                />
              </Field>
              <Button className="w-full" disabled={save.isPending} onClick={() => save.mutate(form)}>
                {t('save')}
              </Button>
            </div>
          </FormSection>

          <FormSection title={t('bo_staff')} description={t('bo_staff_hint')}>
            <Button className="w-full" asChild>
              <Link href="/b/staff/">{t('bo_staff')}</Link>
            </Button>
          </FormSection>
        </TabsContent>
      </Tabs>
    </div>
  );
}
