'use client';

import { useState } from 'react';
import { MemberRole } from '@eatfit/shared';
import {
  useStaffList,
  useInviteStaff,
  useRemoveStaff,
  useUpdateStaffRole,
} from '@/lib/backoffice-queries';
import { useT } from '@/lib/i18n';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export function StaffTab() {
  const t = useT();
  const { data: staff } = useStaffList();
  const invite = useInviteStaff();
  const remove = useRemoveStaff();
  const updateRole = useUpdateStaffRole();
  const [inviteForm, setInviteForm] = useState({ name: '', phone: '', role: MemberRole.Cook });

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">{t('bo_staff')}</h2>
        <p className="text-sm text-muted-foreground">{t('bo_staff_hint')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('bo_invite')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label>{t('name')}</Label>
            <Input value={inviteForm.name} onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>{t('phone')}</Label>
            <Input value={inviteForm.phone} onChange={(e) => setInviteForm({ ...inviteForm, phone: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>{t('adm_role')}</Label>
            <Select
              value={inviteForm.role}
              onValueChange={(v) => setInviteForm({ ...inviteForm, role: v as MemberRole })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={MemberRole.Manager}>{t('role_admin')}</SelectItem>
                <SelectItem value={MemberRole.Cook}>{t('role_cook')}</SelectItem>
                <SelectItem value={MemberRole.Courier}>{t('role_courier')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            className="w-full min-h-11"
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
        </CardContent>
      </Card>

      <div className="space-y-3">
        {staff?.map((m) => (
          <Card key={m.id}>
            <CardContent className="py-3 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <strong>{m.name}</strong>
                  <p className="text-sm text-muted-foreground">{m.phone ?? '—'}</p>
                </div>
                <Badge variant="outline">{m.role}</Badge>
              </div>
              {m.inviteLink && (
                <Button variant="secondary" size="sm" className="w-full" onClick={() => void navigator.clipboard.writeText(m.inviteLink!)}>
                  {t('bo_invite_link')}
                </Button>
              )}
              <div className="flex gap-2">
                <Select
                  value={m.role}
                  onValueChange={(role) =>
                    updateRole.mutate(
                      { id: m.id, role: role as MemberRole },
                      { onSuccess: () => toast.success(t('adm_role_changed')) },
                    )
                  }
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={MemberRole.Manager}>{t('role_admin')}</SelectItem>
                    <SelectItem value={MemberRole.Cook}>{t('role_cook')}</SelectItem>
                    <SelectItem value={MemberRole.Courier}>{t('role_courier')}</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="destructive" size="sm" disabled={remove.isPending} onClick={() => remove.mutate(m.id)}>
                  {t('adm_delete')}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
