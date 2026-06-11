'use client';

import { useState } from 'react';
import { useChecklist, useSetBotToken } from '@/lib/backoffice-queries';
import { useT } from '@/lib/i18n';

/** Онбординг: токен → чеклист (polling) → инструкции по /bind. */
export function OnboardingWizard() {
  const t = useT();
  const [token, setToken] = useState('');
  const setBot = useSetBotToken();
  const { data: checklist } = useChecklist(true);
  const [step, setStep] = useState<'token' | 'checklist'>('token');

  const connect = () => {
    setBot.mutate(token.trim(), {
      onSuccess: () => setStep('checklist'),
    });
  };

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <h3>{t('bo_onboarding')}</h3>
      {step === 'token' && (
        <>
          <p className="muted">{t('bo_token_hint')}</p>
          <div className="field">
            <label>{t('bo_bot_token')}</label>
            <input
              className="input"
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="123456:ABC..."
            />
          </div>
          <button
            className="btn btn-primary"
            disabled={!token.trim() || setBot.isPending}
            onClick={connect}
          >
            {t('bo_connect_bot')}
          </button>
        </>
      )}
      {step === 'checklist' && checklist && (
        <>
          <ul style={{ listStyle: 'none', padding: 0, margin: '12px 0' }}>
            {checklist.items.map((item) => (
              <li key={item.key} style={{ marginBottom: 6 }}>
                {item.ok ? '✅' : '⬜'} {item.label}
              </li>
            ))}
          </ul>
          {checklist.ready ? (
            <p style={{ color: 'var(--accent)' }}>{t('bo_ready')}</p>
          ) : (
            <div className="muted">
              <p>{t('bo_bind_hint')}</p>
              <ol style={{ paddingLeft: 20 }}>
                <li>{t('bo_bind_step1')}</li>
                <li>{t('bo_bind_step2')}</li>
                <li>{t('bo_bind_step3')}</li>
              </ol>
            </div>
          )}
        </>
      )}
    </div>
  );
}
