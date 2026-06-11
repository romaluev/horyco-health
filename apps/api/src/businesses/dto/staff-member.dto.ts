import { ChatKind, ChatStatus, MemberRole, MemberStatus } from '@eatfit/shared';
import { BusinessChat } from '../entities/business-chat.entity';
import { BusinessMember } from '../entities/business-member.entity';
import { Client } from '../../clients/entities/client.entity';

export class StaffMemberDto {
  id!: string;
  clientId!: string;
  name!: string;
  phone!: string | null;
  role!: MemberRole;
  status!: MemberStatus;
  inviteLink!: string | null;

  constructor(member: BusinessMember, client: Client, botUsername: string | null) {
    this.id = member.id;
    this.clientId = member.clientId;
    this.name = client.name;
    this.phone = client.phone;
    this.role = member.role;
    this.status = member.status;
    this.inviteLink =
      member.inviteToken && botUsername
        ? `https://t.me/${botUsername}?start=staff_${member.inviteToken}`
        : null;
  }
}

export class BusinessChatDto {
  kind!: ChatKind;
  chatId!: string | null;
  title!: string | null;
  status!: ChatStatus | null;

  constructor(kind: ChatKind, chat?: BusinessChat | null) {
    this.kind = kind;
    this.chatId = chat?.chatId ?? null;
    this.title = chat?.title ?? null;
    this.status = chat?.status ?? null;
  }
}
