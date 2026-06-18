'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PricingMode } from '@eatfit/shared';
import {
  useAdminMenu,
  useCreateDish,
  useUpdateDish,
  useUploadDishPhoto,
  useDeleteDishPhoto,
} from '@/lib/admin-queries';
import { useSetMenuItemModifierGroups } from '@/lib/modifiers-queries';
import { useT } from '@/lib/i18n';
import { MenuItemDto } from '@/lib/types';
import { toast } from 'sonner';
import { FormPageLayout } from '@/components/admin/ui';
import { Button } from '@/components/ui/button';
import { DishForm } from './DishForm';
import { buildBody, dishFromItem, emptyForm } from './utils';

export function MenuFormContent({ itemId }: { itemId?: string }) {
  const t = useT();
  const router = useRouter();
  const { data: items } = useAdminMenu();
  const create = useCreateDish();
  const update = useUpdateDish();
  const uploadPhoto = useUploadDishPhoto();
  const deletePhoto = useDeleteDishPhoto();
  const setGroups = useSetMenuItemModifierGroups();

  const editing = itemId ? items?.find((it) => it.id === itemId) : null;
  const isNew = !itemId;

  const [form, setForm] = useState(emptyForm());
  const [photoVer, setPhotoVer] = useState(0);
  const [hasPhoto, setHasPhoto] = useState(false);
  const [pendingPhoto, setPendingPhoto] = useState<File | null>(null);
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);
  const [modifierGroupIds, setModifierGroupIds] = useState<string[]>([]);
  const [initialized, setInitialized] = useState(isNew);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isNew) return;
    if (items && itemId && !editing) {
      router.replace('/b/menu');
      return;
    }
    if (editing && !initialized) {
      setForm(dishFromItem(editing));
      setHasPhoto(editing.hasPhoto);
      setInitialized(true);
    }
  }, [isNew, items, itemId, editing, initialized, router]);

  const setPending = (file: File | null) => {
    setPendingPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return file ? URL.createObjectURL(file) : null;
    });
    setPendingPhoto(file);
  };

  const onPickPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (editing) {
      uploadPhoto.mutate(
        { id: editing.id, file },
        {
          onSuccess: () => {
            setHasPhoto(true);
            setPhotoVer((v) => v + 1);
          },
          onError: (e) => toast.error(t('adm_photo_error') + (e as Error).message),
        },
      );
    } else {
      setPending(file);
    }
  };

  const onRemovePhoto = () => {
    if (!editing) return;
    deletePhoto.mutate(editing.id, {
      onSuccess: () => {
        setHasPhoto(false);
        setPhotoVer((v) => v + 1);
      },
    });
  };

  const finishAfterGroups = (savedId: string) => {
    if (pendingPhoto && isNew) {
      uploadPhoto.mutate(
        { id: savedId, file: pendingPhoto },
        {
          onSuccess: () => router.push(`/b/menu/edit?id=${savedId}`),
          onError: (e) => {
            toast.error(t('adm_photo_error') + (e as Error).message);
            router.push(`/b/menu/edit?id=${savedId}`);
          },
        },
      );
    } else {
      router.push(`/b/menu/edit?id=${savedId}`);
    }
  };

  const saveModifierGroups = (savedId: string) => {
    setGroups.mutate(
      { menuItemId: savedId, groupIds: modifierGroupIds },
      {
        onSuccess: () => finishAfterGroups(savedId),
        onError: (e) => {
          toast.error(`${t('save')}: ${(e as Error).message}`);
          finishAfterGroups(savedId);
        },
      },
    );
  };

  const submit = () => {
    const body = buildBody(form);
    if (editing) {
      update.mutate(
        { id: editing.id, body },
        {
          onSuccess: () => saveModifierGroups(editing.id),
          onError: (e) => toast.error(`${t('save')}: ${(e as Error).message}`),
        },
      );
      return;
    }
    create.mutate(body, {
      onError: (e) => toast.error(`${t('save')}: ${(e as Error).message}`),
      onSuccess: (created) => saveModifierGroups(created.id),
    });
  };

  const saveDisabled =
    !form.nameRu ||
    !form.nameUz ||
    (form.pricingMode === PricingMode.PerUnit
      ? !form.pricePerStep || form.pricePerStep <= 0
      : form.price <= 0) ||
    create.isPending ||
    update.isPending ||
    uploadPhoto.isPending ||
    setGroups.isPending;

  if (!isNew && !initialized) {
    return <p className="py-8 text-center text-muted-foreground">{t('loading')}</p>;
  }

  const editingDto: MenuItemDto | null = editing ?? null;

  return (
    <FormPageLayout
      backHref="/b/menu"
      title={isNew ? t('adm_add_dish') : form.nameRu || t('adm_edit')}
      description={isNew ? undefined : form.nameUz || undefined}
      actions={
        <>
          <Button type="button" variant="outline" onClick={() => router.push('/b/menu')}>
            {t('act_cancel')}
          </Button>
          <Button type="button" disabled={saveDisabled} onClick={submit}>
            {create.isPending || update.isPending || setGroups.isPending
              ? t('loading')
              : t('save')}
          </Button>
        </>
      }
    >
      <DishForm
        form={form}
        setForm={setForm}
        editing={editingDto}
        hasPhoto={hasPhoto}
        photoVer={photoVer}
        pendingPreview={pendingPreview}
        pendingPhoto={pendingPhoto}
        fileRef={fileRef}
        onPickPhoto={onPickPhoto}
        onRemovePhoto={onRemovePhoto}
        uploadPhotoPending={uploadPhoto.isPending}
        deletePhotoPending={deletePhoto.isPending}
        onClearPending={() => setPending(null)}
        modifierGroupIds={modifierGroupIds}
        onModifierGroupIdsChange={setModifierGroupIds}
      />
    </FormPageLayout>
  );
}
