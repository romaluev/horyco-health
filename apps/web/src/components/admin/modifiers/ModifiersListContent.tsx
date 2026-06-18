'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Language } from '@eatfit/shared';
import { Layers, Pencil, Plus, Trash2 } from 'lucide-react';
import {
  useModifierGroupsAdmin,
  useDeleteModifierGroup,
  type ModifierGroupRow,
} from '@/lib/modifiers-queries';
import { useT } from '@/lib/i18n';
import { pick } from '@/lib/format';
import { useAuthStore } from '@/store/auth.store';
import {
  AdminEmptyState,
  DashboardPageHeader,
  DataTableShell,
  type DataTableColumn,
} from '@/components/admin/ui';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export function ModifiersListContent() {
  const t = useT();
  const router = useRouter();
  const lang = useAuthStore((s) => s.client?.language ?? Language.Ru);
  const { data: groups, isLoading } = useModifierGroupsAdmin();
  const deleteGroup = useDeleteModifierGroup();

  const columns: DataTableColumn<ModifierGroupRow>[] = [
    {
      key: 'name',
      header: t('adm_name_ru'),
      render: (g) => (
        <div>
          <div className="font-medium">{pick(lang, g.nameRu, g.nameUz)}</div>
          {g.nameUz && g.nameRu !== g.nameUz ? (
            <div className="text-xs text-muted-foreground">{g.nameUz}</div>
          ) : null}
        </div>
      ),
    },
    {
      key: 'type',
      header: t('bo_mod_selection'),
      primary: false,
      render: (g) => (
        <div className="flex flex-wrap gap-1">
          <Badge variant="secondary">
            {g.selectionType === 'SINGLE' ? t('bo_mod_single') : t('bo_mod_multiple')}
          </Badge>
          {g.kind === 'addition' ? (
            <Badge variant="outline">{t('bo_mod_kind_addition')}</Badge>
          ) : null}
          {g.pricingType !== 'PAID' ? (
            <Badge variant="outline">
              {g.pricingType === 'FREE' ? t('bo_mod_free') : t('bo_mod_included')}
            </Badge>
          ) : null}
        </div>
      ),
    },
    {
      key: 'items',
      header: t('bo_mod_add_item'),
      primary: false,
      className: 'hidden lg:table-cell',
      render: (g) => <span className="tabular-nums">{g.modifiers.length}</span>,
    },
    {
      key: 'status',
      header: t('adm_active'),
      primary: false,
      className: 'hidden sm:table-cell',
      render: (g) => (
        <div className="flex flex-wrap gap-1">
          {g.isRequired ? <Badge>{t('mod_required')}</Badge> : null}
          {!g.isActive ? (
            <Badge variant="secondary">{t('adm_hidden')}</Badge>
          ) : (
            <Badge variant="outline">{t('adm_active')}</Badge>
          )}
        </div>
      ),
    },
  ];

  if (isLoading) {
    return <p className="py-8 text-center text-muted-foreground">{t('loading')}</p>;
  }

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title={t('bo_modifiers')}
        actions={
          <Button asChild>
            <Link href="/b/modifiers/new">
              <Plus className="h-4 w-4" />
              {t('bo_mod_new_group')}
            </Link>
          </Button>
        }
      />

      <DataTableShell
        columns={columns}
        rows={groups ?? []}
        keyFn={(g) => g.id}
        onRowClick={(g) => router.push(`/b/modifiers/edit?id=${g.id}`)}
        actions={(g) => (
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="outline"
              size="icon"
              aria-label={t('adm_edit')}
              onClick={() => router.push(`/b/modifiers/edit?id=${g.id}`)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              aria-label={t('adm_delete')}
              className="text-destructive hover:text-destructive"
              onClick={() => {
                if (window.confirm(t('bo_mod_delete_group_q'))) deleteGroup.mutate(g.id);
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
        empty={
          <AdminEmptyState
            icon={Layers}
            title={t('bo_modifiers_empty')}
            action={
              <Button asChild>
                <Link href="/b/modifiers/new">
                  <Plus className="h-4 w-4" />
                  {t('bo_mod_new_group')}
                </Link>
              </Button>
            }
          />
        }
      />
    </div>
  );
}
