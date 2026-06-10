'use client';

import { useEffect, useState } from 'react';
import { useSettings, useSaveSettings } from '@/lib/admin-queries';
import { useT, type I18nKey } from '@/lib/i18n';

const FIELDS: { key: 'topupTelegram' | 'topupPhone' | 'supportContact'; label: I18nKey }[] = [
  { key: 'topupTelegram', label: 'set_topup_tg' },
  { key: 'topupPhone', label: 'set_topup_phone' },
  { key: 'supportContact', label: 'set_support' },
];

export function AdminSettings() {
  const t = useT();
  const { data } = useSettings();
  const save = useSaveSettings();
  const [form, setForm] = useState({ topupTelegram: '', topupPhone: '', supportContact: '' });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (data) {
      setForm({
        topupTelegram: data.topupTelegram ?? '',
        topupPhone: data.topupPhone ?? '',
        supportContact: data.supportContact ?? '',
      });
    }
  }, [data]);

  return (
    <div>
      {FIELDS.map((f) => (
        <div className="field" key={f.key}>
          <label>{t(f.label)}</label>
          <input
            className="input"
            value={form[f.key]}
            onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
          />
        </div>
      ))}
      <button
        className="btn btn-primary btn-block"
        disabled={save.isPending}
        onClick={() =>
          save.mutate(form, {
            onSuccess: () => {
              setSaved(true);
              setTimeout(() => setSaved(false), 1500);
            },
          })
        }
      >
        {saved ? t('saved') : t('save')}
      </button>
    </div>
  );
}
