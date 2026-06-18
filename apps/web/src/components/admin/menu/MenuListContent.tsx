'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ChefHat,
  Eye,
  EyeOff,
  Link2,
  Pencil,
  Plus,
  Send,
  Trash2,
} from 'lucide-react';
import {
  useAdminMenu,
  useSetDishActive,
  useDeleteDish,
  usePublicConfig,
  usePublishDish,
} from '@/lib/admin-queries';
import { useT } from '@/lib/i18n';
import { formatMoney } from '@/lib/format';
import { MenuItemDto } from '@/lib/types';
import { toast } from 'sonner';
import {
  AdminEmptyState,
  DashboardPageHeader,
  DataTableShell,
  FilterBar,
  type DataTableColumn,
} from '@/components/admin/ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { categoryLabel, formatDays } from './utils';

export function MenuListContent() {
  const t = useT();
  const router = useRouter();
  const { data: items } = useAdminMenu();
  const setActive = useSetDishActive();
  const del = useDeleteDish();
  const { data: config } = usePublicConfig();
  const publish = usePublishDish();

  const [postFor, setPostFor] = useState<MenuItemDto | null>(null);
  const [q, setQ] = useState('');

  const onPublish = (id: string) => {
    publish.mutate(id, {
      onSuccess: () => toast.success(t('adm_published')),
      onError: (e) => toast.error((e as Error).message),
    });
  };

  const deepLink = (id: string): string | null =>
    config?.botUsername ? `https://t.me/${config.botUsername}?start=item_${id}` : null;

  const copyLink = async (id: string) => {
    const link = deepLink(id);
    if (!link) {
      toast.error(t('adm_no_bot_username'));
      return;
    }
    try {
      await navigator.clipboard.writeText(link);
      toast.success(t('adm_link_copied'));
    } catch {
      window.prompt(t('adm_copy_link'), link);
    }
  };

  const needle = q.trim().toLowerCase();
  const filtered = needle
    ? items?.filter((it) => `${it.nameRu} ${it.nameUz}`.toLowerCase().includes(needle))
    : items;

  const columns: DataTableColumn<MenuItemDto>[] = [
    {
      key: 'name',
      header: t('adm_name_ru'),
      primary: true,
      render: (it) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{it.nameRu}</p>
          {it.nameUz && it.nameUz !== it.nameRu ? (
            <p className="truncate text-xs text-muted-foreground">{it.nameUz}</p>
          ) : null}
        </div>
      ),
    },
    {
      key: 'price',
      header: t('adm_price'),
      render: (it) => (
        <span className="whitespace-nowrap tabular-nums">
          {formatMoney(it.price)} {t('currency')}
        </span>
      ),
    },
    {
      key: 'category',
      header: t('adm_category'),
      primary: false,
      render: (it) => categoryLabel(t, it.category),
    },
    {
      key: 'days',
      header: t('adm_days'),
      primary: false,
      render: (it) => (it.days?.length ? formatDays(t, it.days) : '—'),
    },
    {
      key: 'status',
      header: t('status'),
      render: (it) => (
        <Badge variant={it.isActive ? 'default' : 'secondary'}>
          {it.isActive ? t('bo_orders_filter_active') : t('adm_hidden')}
        </Badge>
      ),
    },
  ];

  const postItem = postFor;
  const postLink = postItem ? deepLink(postItem.id) : null;

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title={t('adm_menu')}
        actions={
          <Button asChild>
            <Link href="/b/menu/new">
              <Plus className="h-4 w-4" />
              {t('adm_add_dish')}
            </Link>
          </Button>
        }
      />

      <FilterBar
        left={
          <Input
            className="max-w-sm"
            placeholder={t('search_ph')}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        }
      />

      <DataTableShell
        columns={columns}
        rows={filtered ?? []}
        keyFn={(it) => it.id}
        onRowClick={(it) => router.push(`/b/menu/edit?id=${it.id}`)}
        actions={(it) => (
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="outline"
              size="icon"
              aria-label={t('adm_edit')}
              onClick={() => router.push(`/b/menu/edit?id=${it.id}`)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              aria-label={it.isActive ? t('adm_hide') : t('adm_show')}
              onClick={() => setActive.mutate({ id: it.id, isActive: !it.isActive })}
            >
              {it.isActive ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
            <Button
              variant="outline"
              size="icon"
              aria-label={t('adm_copy_link')}
              onClick={() => void copyLink(it.id)}
            >
              <Link2 className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              aria-label={t('adm_delete')}
              className="text-destructive hover:text-destructive"
              onClick={() => {
                if (window.confirm(t('adm_delete_q'))) del.mutate(it.id);
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
        empty={
          needle && !filtered?.length ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t('nothing_found')}</p>
          ) : !items?.length ? (
            <AdminEmptyState
              icon={ChefHat}
              title={t('adm_add_dish')}
              action={
                <Button asChild>
                  <Link href="/b/menu/new">
                    <Plus className="h-4 w-4" />
                    {t('adm_add_dish')}
                  </Link>
                </Button>
              }
            />
          ) : null
        }
      />

      <Dialog open={Boolean(postItem)} onOpenChange={(open) => !open && setPostFor(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('adm_post_preview')}</DialogTitle>
          </DialogHeader>
          {postItem ? (
            <div className="space-y-3">
              {postItem.hasPhoto ? (
                <img
                  className="max-h-44 w-full rounded-lg object-cover"
                  src={`/api/menu/${postItem.id}/photo`}
                  alt={postItem.nameRu}
                />
              ) : null}
              <div>
                <p className="font-semibold">
                  {postItem.nameUz || postItem.nameRu}
                  {postItem.nameRu &&
                  postItem.nameUz &&
                  postItem.nameUz !== postItem.nameRu
                    ? ` / ${postItem.nameRu}`
                    : ''}
                </p>
                <p className="text-sm text-muted-foreground">
                  {formatMoney(postItem.price)} {t('currency')}
                </p>
              </div>
              {postLink ? (
                <Button className="w-full" asChild>
                  <a href={postLink} target="_blank" rel="noreferrer">
                    {t('adm_order_btn')}
                  </a>
                </Button>
              ) : (
                <p className="text-sm text-muted-foreground">{t('adm_no_bot_username')}</p>
              )}
              <Button
                className="w-full"
                variant="secondary"
                disabled={publish.isPending}
                onClick={() => onPublish(postItem.id)}
              >
                <Send className="h-4 w-4" />
                {publish.isPending ? t('adm_publishing') : t('adm_publish')}
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
