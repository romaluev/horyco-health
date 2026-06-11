'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, Circle, Copy } from 'lucide-react';
import {
  useBusinessSettings,
  useBusinessChats,
  useChecklist,
  useSetBotToken,
  useStaffList,
} from '@/lib/backoffice-queries';
import { useT } from '@/lib/i18n';

const BIND_COMMANDS = [
  { kind: 'cook', cmd: '/bind cook' },
  { kind: 'courier', cmd: '/bind courier' },
  { kind: 'admin', cmd: '/bind admin' },
];

export function OnboardingWizardPage() {
  const t = useT();
  const { data: settings } = useBusinessSettings();
  const { data: checklist } = useChecklist(true);
  const { data: chats } = useBusinessChats();
  const { data: staff } = useStaffList();
  const setBot = useSetBotToken();
  const [token, setToken] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  const itemOk = (key: string) => checklist?.items.find((i) => i.key === key)?.ok ?? false;

  const copyCmd = async (cmd: string) => {
    try {
      await navigator.clipboard.writeText(cmd);
      setCopied(cmd);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      /* ignore */
    }
  };

  const steps = [
    {
      id: 'bot',
      title: t('bo_onboarding_step_bot'),
      done: itemOk('token') && itemOk('webhook'),
      body: (
        <>
          <p className="adm-muted">{t('bo_token_hint')}</p>
          <div className="adm-field">
            <label>{t('bo_bot_token')}</label>
            <input
              className="adm-input"
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="123456:ABC..."
            />
          </div>
          <button
            type="button"
            className="adm-btn adm-btn-primary adm-btn-sm"
            disabled={!token.trim() || setBot.isPending}
            onClick={() => setBot.mutate(token.trim())}
          >
            {t('bo_connect_bot')}
          </button>
        </>
      ),
    },
    {
      id: 'groups',
      title: t('bo_onboarding_step_groups'),
      done: itemOk('cook_group') && itemOk('admin_group'),
      body: (
        <>
          <p className="adm-muted">{t('bo_bind_hint')}</p>
          <ul style={{ listStyle: 'none', padding: 0, margin: '12px 0' }}>
            {BIND_COMMANDS.map(({ kind, cmd }) => {
              const bound = chats?.find((c) => c.kind === kind && c.chatId);
              return (
                <li key={kind} style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <code>{cmd}</code>
                  <button type="button" className="adm-btn adm-btn-sm" onClick={() => void copyCmd(cmd)}>
                    <Copy size={14} aria-hidden /> {copied === cmd ? t('bo_copied') : t('bo_bind_copy')}
                  </button>
                  {bound && <span className="adm-badge adm-badge-ok">OK</span>}
                </li>
              );
            })}
          </ul>
          <p className="adm-muted" style={{ fontSize: 13 }}>{t('bo_bind_step1')}</p>
        </>
      ),
    },
    {
      id: 'menu',
      title: t('bo_onboarding_step_menu'),
      done: itemOk('menu'),
      body: (
        <>
          <p className="adm-muted">{checklist?.items.find((i) => i.key === 'menu')?.hint}</p>
          <Link href="/b/menu/" className="adm-btn adm-btn-primary adm-btn-sm">
            {t('bo_go_menu')}
          </Link>
        </>
      ),
    },
    {
      id: 'staff',
      title: t('bo_onboarding_step_staff'),
      done: itemOk('cook'),
      body: (
        <>
          <p className="adm-muted">{checklist?.items.find((i) => i.key === 'cook')?.hint}</p>
          {staff?.filter((s) => s.status === 'active' && s.inviteLink).slice(0, 1).map((s) => (
            <p key={s.id} style={{ wordBreak: 'break-all', fontSize: 13 }}>{s.inviteLink}</p>
          ))}
          <Link href="/b/settings/" className="adm-btn adm-btn-sm">
            {t('bo_go_settings')}
          </Link>
        </>
      ),
    },
    {
      id: 'live',
      title: t('bo_onboarding_step_live'),
      done: checklist?.ready ?? false,
      body: (
        <>
          {checklist?.ready ? (
            <div className="adm-alert adm-alert-success">{t('bo_ready')}</div>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {checklist?.items.map((item) => (
                <li key={item.key} style={{ display: 'flex', gap: 8, marginBottom: 6, fontSize: 14 }}>
                  {item.ok ? <Check size={16} color="var(--adm-success)" /> : <Circle size={16} />}
                  <span>{item.label}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      ),
    },
  ];

  const activeIdx = steps.findIndex((s) => !s.done);

  return (
    <div className="adm-card">
      <h3>{t('bo_onboarding')}</h3>
      {settings?.botUsername && (
        <p className="adm-muted">@{settings.botUsername}</p>
      )}
      <div className="adm-stepper">
        {steps.map((step, idx) => (
          <div
            key={step.id}
            className={`adm-step${step.done ? ' done' : ''}${activeIdx === idx ? ' active' : ''}`}
          >
            <div className="adm-step-icon">{step.done ? <Check size={16} /> : idx + 1}</div>
            <div className="adm-step-body">
              <h4>{step.title}</h4>
              {!step.done && activeIdx === idx && step.body}
              {step.done && <p>{t('bo_ready')}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
