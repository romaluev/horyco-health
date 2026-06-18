'use client';

import { useMemo, useState } from 'react';
import { MemberRole } from '@eatfit/shared';
import { Copy, Trash2 } from 'lucide-react';
import {
  useStaffList,
  useInviteStaff,
  useRemoveStaff,
  useUpdateStaffRole,
} from '@/lib/backoffice-queries';
import { useT } from '@/lib/i18n';
import { PageHeader, FormSection, FormGrid, Field, DataList, type DataListColumn } from '@/components/admin/ui';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select';
import { toast } from 'sonner';

type StaffRow = NonNullable<ReturnType<typeof useStaffList>['data']>[number];

const ROLE_OPTIONS = [MemberRole.Manager, MemberRole.Cook, MemberRole.Courier] as const;

function roleLabel(t: (key: 'role_admin' | 'role_cook' | 'role_courier') => string, role: MemberRole): string {
  switch (role) {
    case MemberRole.Manager:
      return t('role_admin');
    case MemberRole.Cook:
      return t('role_cook');
    case MemberRole.Courier:
      return t('role_courier');
    default:
      return role;
  }
}

export function StaffTab() {
  const t = useT();
  const { data: staff } = useStaffList();
  const invite = useInviteStaff();
  const remove = useRemoveStaff();
  const updateRole = useUpdateStaffRole();
  const [inviteForm, setInviteForm] = useState({ name: '', phone: '', role: MemberRole.Cook });

  const columns = useMemo<DataListColumn<StaffRow>[]>(
    () => [
      {
        key: 'name',
        header: t('name'),
        primary: true,
        render: (m) => (
          <div>
            <p className="font-medium">{m.name}</p>
            <p className="text-xs text-muted-foreground md:hidden">{m.phone ?? '—'}</p>
          </div>
        ),
      },
      {
        key: 'phone',
        header: t('phone'),
        primary: false,
        className: 'hidden md:table-cell',
        render: (m) => <span className="text-muted-foreground">{m.phone ?? '—'}</span>,
      },
      {
        key: 'role',
        header: t('adm_role'),
        render: (m) => (
          <Select
            value={m.role}
            onValueChange={(role) =>
              updateRole.mutate(
                { id: m.id, role: role as MemberRole },
                { onSuccess: () => toast.success(t('adm_role_changed')) },
              )
            }
          >
            <SelectTrigger className="w-[140px]" />
            <SelectContent>
              {ROLE_OPTIONS.map((role) => (
                <SelectItem key={role} value={role}>
                  {roleLabel(t, role)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ),
      },
    ],
    [t, updateRole],
  );

  return (
    <div className="space-y-4">
      <PageHeader title={t('bo_staff')} description={t('bo_staff_hint')} />

      <FormSection title={t('bo_invite')}>
        <div className="space-y-4">
          <FormGrid>
            <Field label={t('name')}>
              <Input value={inviteForm.name} onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })} />
            </Field>
            <Field label={t('phone')}>
              <Input value={inviteForm.phone} onChange={(e) => setInviteForm({ ...inviteForm, phone: e.target.value })} />
            </Field>
          </FormGrid>
          <Field label={t('adm_role')}>
            <Select
              value={inviteForm.role}
              onValueChange={(v) => setInviteForm({ ...inviteForm, role: v as MemberRole })}
            >
              <SelectTrigger placeholder={roleLabel(t, inviteForm.role)} />
              <SelectContent>
                {ROLE_OPTIONS.map((role) => (
                  <SelectItem key={role} value={role}>
                    {roleLabel(t, role)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Button
            className="w-full"
            disabled={invite.isPending || !inviteForm.name || !inviteForm.phone}
            onClick={() =>
              invite.mutate(inviteForm, {
                onSuccess: (row) => {
                  toast.success(t('bo_invite_link'));
                  if (row.inviteLink) void navigator.clipboard.writeText(row.inviteLink);
                  setInviteForm({ name: '', phone: '', role: MemberRole.Cook });
                },
              })
            }
          >
            {t('bo_invite')}
          </Button>
        </div>
      </FormSection>

      <DataList
        columns={columns}
        rows={staff ?? []}
        keyFn={(m) => m.id}
        empty={<p className="text-sm text-muted-foreground">{t('nothing_found')}</p>}
        actions={(m) => (
          <div className="flex items-center gap-1">
            {m.inviteLink ? (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t('bo_invite_link')}
                onClick={() => void navigator.clipboard.writeText(m.inviteLink!)}
              >
                <Copy />
              </Button>
            ) : null}
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-destructive hover:text-destructive"
              aria-label={t('adm_delete')}
              disabled={remove.isPending}
              onClick={() => remove.mutate(m.id)}
            >
              <Trash2 />
            </Button>
          </div>
        )}
      />
    </div>
  );
}
