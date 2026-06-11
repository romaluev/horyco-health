'use client';

import { useModifierGroups } from '@/lib/offers-queries';
import { useT } from '@/lib/i18n';

export function ModifiersTab() {
  const t = useT();
  const { data: groups, isLoading } = useModifierGroups();

  if (isLoading) return <div className="center">{t('loading')}</div>;

  return (
    <div>
      <h3>{t('bo_modifiers')}</h3>
      {!groups?.length && <p className="muted">{t('bo_modifiers_empty')}</p>}
      {groups?.map((g) => (
        <div className="card" key={g.id}>
          <strong>{g.nameRu}</strong>
          <div className="dish-desc">
            {g.modifiers.map((m) => m.nameRu).join(', ') || '—'}
          </div>
        </div>
      ))}
    </div>
  );
}
