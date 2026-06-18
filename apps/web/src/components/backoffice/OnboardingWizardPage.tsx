'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Check, ChevronDown, Circle, Copy } from 'lucide-react';
import {
  useBusinessSettings,
  useBusinessChats,
  useChecklist,
  useSetBotToken,
  useStaffList,
} from '@/lib/backoffice-queries';
import { useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/admin/ui';

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
  const [expandedId, setExpandedId] = useState<string | null>(null);

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

  const steps: { id: string; title: string; done: boolean; body: ReactNode }[] = [
    {
      id: 'bot',
      title: t('bo_onboarding_step_bot'),
      done: itemOk('token') && itemOk('webhook'),
      body: (
        <>
          <p className="text-sm text-muted-foreground">{t('bo_token_hint')}</p>
          <Field label={t('bo_bot_token')}>
            <Input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="123456:ABC..."
            />
          </Field>
          <Button size="sm" disabled={!token.trim() || setBot.isPending} onClick={() => setBot.mutate(token.trim())}>
            {t('bo_connect_bot')}
          </Button>
        </>
      ),
    },
    {
      id: 'groups',
      title: t('bo_onboarding_step_groups'),
      done: itemOk('cook_group') && itemOk('admin_group'),
      body: (
        <>
          <p className="text-sm text-muted-foreground">{t('bo_bind_hint')}</p>
          <ul className="my-3 list-none space-y-2.5 p-0">
            {BIND_COMMANDS.map(({ kind, cmd }) => {
              const bound = chats?.find((c) => c.kind === kind && c.chatId && c.status === 'active');
              return (
                <li key={kind} className="flex flex-wrap items-center gap-2">
                  <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{cmd}</code>
                  <Button type="button" variant="outline" size="sm" onClick={() => void copyCmd(cmd)}>
                    <Copy className="mr-1.5 size-3.5" aria-hidden />
                    {copied === cmd ? t('bo_copied') : t('bo_bind_copy')}
                  </Button>
                  {bound ? (
                    <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                      OK
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-muted-foreground">{t('bo_bind_step1')}</p>
        </>
      ),
    },
    {
      id: 'menu',
      title: t('bo_onboarding_step_menu'),
      done: itemOk('menu'),
      body: (
        <>
          <p className="text-sm text-muted-foreground">{checklist?.items.find((i) => i.key === 'menu')?.hint}</p>
          <Button size="sm" asChild>
            <Link href="/b/menu/">{t('bo_go_menu')}</Link>
          </Button>
        </>
      ),
    },
    {
      id: 'staff',
      title: t('bo_onboarding_step_staff'),
      done: itemOk('cook'),
      body: (
        <>
          <p className="text-sm text-muted-foreground">{checklist?.items.find((i) => i.key === 'cook')?.hint}</p>
          {staff
            ?.filter((s) => s.status === 'active' && s.inviteLink)
            .slice(0, 1)
            .map((s) => (
              <p key={s.id} className="break-all text-xs text-muted-foreground">
                {s.inviteLink}
              </p>
            ))}
          <Button variant="outline" size="sm" asChild>
            <Link href="/b/settings/">{t('bo_go_settings')}</Link>
          </Button>
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
            <div className="rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">
              {t('bo_ready')}
            </div>
          ) : (
            <ul className="m-0 list-none space-y-1.5 p-0">
              {checklist?.items.map((item) => (
                <li key={item.key} className="flex items-start gap-2 text-sm">
                  {item.ok ? (
                    <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
                  ) : (
                    <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                  )}
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
  const defaultExpanded = activeIdx >= 0 ? steps[activeIdx].id : steps[steps.length - 1]?.id ?? null;

  useEffect(() => {
    if (expandedId === null && defaultExpanded) {
      setExpandedId(defaultExpanded);
    }
  }, [defaultExpanded, expandedId]);

  const toggleStep = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="rounded-lg border bg-card p-4 md:p-6">
      <h3 className="text-lg font-semibold">{t('bo_onboarding')}</h3>
      {settings?.botUsername ? <p className="text-sm text-muted-foreground">@{settings.botUsername}</p> : null}

      <div className="adm-stepper mt-4">
        {steps.map((step, idx) => {
          const isActive = activeIdx === idx;
          const isExpanded = expandedId === step.id;
          return (
            <div
              key={step.id}
              className={cn('adm-step', step.done && 'done', isActive && 'active')}
            >
              <div className="adm-step-icon">{step.done ? <Check className="size-4" /> : idx + 1}</div>
              <div className="adm-step-body min-w-0 flex-1">
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-2 text-left"
                  onClick={() => toggleStep(step.id)}
                  aria-expanded={isExpanded}
                >
                  <h4 className="text-sm font-semibold">{step.title}</h4>
                  <ChevronDown
                    className={cn('size-4 shrink-0 text-muted-foreground transition-transform', isExpanded && 'rotate-180')}
                    aria-hidden
                  />
                </button>
                {step.done && !isExpanded ? (
                  <p className="text-xs text-emerald-600">{t('bo_onboarding_step_complete')}</p>
                ) : null}
                {isExpanded ? <div className="mt-3 space-y-3">{step.body}</div> : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
