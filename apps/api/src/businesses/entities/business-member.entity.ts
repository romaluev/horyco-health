import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { MemberRole, MemberStatus } from '@eatfit/shared';
import { BaseEntity } from '../../common/database/base.entity';
import { Business } from './business.entity';
import { Client } from '../../clients/entities/client.entity';

/**
 * Участник бизнеса (staff): owner/manager/cook/courier. Источник прав внутри
 * бизнеса — членство, а не legacy clients.role. Один человек может быть
 * сотрудником нескольких бизнесов (UNIQUE на пару business+client).
 */
@Entity('business_members')
@Index('uq_business_member', ['businessId', 'clientId'], { unique: true })
export class BusinessMember extends BaseEntity {
  @ManyToOne(() => Business, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'business_id' })
  business!: Business;

  @Column({ type: 'uuid' })
  businessId!: string;

  @ManyToOne(() => Client, { nullable: false })
  @JoinColumn({ name: 'client_id' })
  client!: Client;

  @Column({ type: 'uuid' })
  clientId!: string;

  @Column({ type: 'enum', enum: MemberRole })
  role!: MemberRole;

  @Column({ type: 'enum', enum: MemberStatus, default: MemberStatus.Invited })
  status!: MemberStatus;

  // Одноразовый токен приглашения (deep link t.me/<bot>?start=staff_<token>).
  @Index({ unique: true, where: 'invite_token IS NOT NULL' })
  @Column({ type: 'varchar', nullable: true })
  inviteToken!: string | null;

  @Column({ type: 'uuid', nullable: true })
  invitedById!: string | null;
}
