import { Injectable } from '@nestjs/common';
import { EntityTarget } from 'typeorm';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { MemberStatus } from '@eatfit/shared';
import { TransactionalRepository } from '../common/database/transactional-repository';
import { BusinessMember } from './entities/business-member.entity';

@Injectable()
export class BusinessMembersRepository extends TransactionalRepository<BusinessMember> {
  protected readonly entity: EntityTarget<BusinessMember> = BusinessMember;

  constructor(txHost: TransactionHost<TransactionalAdapterTypeOrm>) {
    super(txHost);
  }

  findActive(businessId: string, clientId: string): Promise<BusinessMember | null> {
    return this.repo.findOne({ where: { businessId, clientId, status: MemberStatus.Active } });
  }

  findAllByBusiness(businessId: string): Promise<BusinessMember[]> {
    return this.repo.find({ where: { businessId }, order: { createdAt: 'ASC' } });
  }

  /** Все активные членства человека (для выбора бизнеса при staff-входе). */
  findActiveByClient(clientId: string): Promise<BusinessMember[]> {
    return this.repo.find({ where: { clientId, status: MemberStatus.Active } });
  }

  findByInviteToken(token: string): Promise<BusinessMember | null> {
    return this.repo.findOne({ where: { inviteToken: token } });
  }

  findById(id: string): Promise<BusinessMember | null> {
    return this.repo.findOne({ where: { id } });
  }

  findAny(businessId: string, clientId: string): Promise<BusinessMember | null> {
    return this.repo.findOne({ where: { businessId, clientId } });
  }

  create(data: Partial<BusinessMember>): Promise<BusinessMember> {
    return this.repo.save(this.repo.create(data));
  }

  save(member: BusinessMember): Promise<BusinessMember> {
    return this.repo.save(member);
  }
}
