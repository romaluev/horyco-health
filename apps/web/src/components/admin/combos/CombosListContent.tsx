'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Language } from '@eatfit/shared';
import { Layers, Pencil, Plus, Send } from 'lucide-react';
import {
  useAdminCombos,
  usePublishCombo,
} from '@/lib/admin-queries';
import { useT } from '@/lib/i18n';
import { formatMoney, pick } from '@/lib/format';
import { useAuthStore } from '@/store/auth.store';
import { toast } from 'sonner';
import {
  AdminEmptyState,
  DashboardPageHeader,
  DataTableShell,
  type DataTableColumn,
} from '@/components/admin/ui';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

type ComboListRow = {
  id: string;
  nameRu: string;
  nameUz: string;
  price: string;
  isActive: boolean;
};

export function CombosListContent() {
  const t = useT();
  const router = useRouter();
  const lang = useAuthStore((s) => s.client?.language ?? Language.Ru);
  const { data: combos } = useAdminCombos();
  const publish = usePublishCombo();

  const doPublish = (id: string) => {
    publish.mutate(id, {
      onSuccess: () => toast.success(t('adm_published')),
      onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
    });
  };

  const columns: DataTableColumn<ComboListRow>[] = [
    {
      key: 'name',
      header: t('adm_name_ru'),
      render: (c) => (
        <div>
          <div className="font-medium">{pick(lang, c.nameRu, c.nameUz)}</div>
          {!c.isActive ? (
            <Badge variant="secondary" className="mt-1">
              {t('adm_hidden')}
            </Badge>
          ) : null}
        </div>
      ),
    },
    {
      key: 'price',
      header: t('adm_price'),
      primary: false,
      render: (c) => (
        <span className="tabular-nums">
          {formatMoney(c.price)} {t('currency')}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title={t('bo_combos')}
        description={t('bo_combos_manage_hint')}
        actions={
          <Button asChild>
            <Link href="/b/combos/new">
              <Plus className="h-4 w-4" />
              {t('bo_combo_new')}
            </Link>
          </Button>
        }
      />

      <DataTableShell
        columns={columns}
        rows={combos ?? []}
        keyFn={(c) => c.id}
        onRowClick={(c) => router.push(`/b/combos/edit?id=${c.id}`)}
        actions={(c) => (
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="outline"
              size="icon"
              aria-label={t('adm_edit')}
              onClick={() => router.push(`/b/combos/edit?id=${c.id}`)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              aria-label={t('adm_publish')}
              disabled={publish.isPending || !c.isActive}
              onClick={() => doPublish(c.id)}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        )}
        empty={
          <AdminEmptyState
            icon={Layers}
            title={t('bo_combos_empty')}
            action={
              <Button asChild>
                <Link href="/b/combos/new">
                  <Plus className="h-4 w-4" />
                  {t('bo_combo_new')}
                </Link>
              </Button>
            }
          />
        }
      />
    </div>
  );
}
