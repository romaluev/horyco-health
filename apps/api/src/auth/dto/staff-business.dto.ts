import { MemberRole } from '@eatfit/shared';
import { Business } from '../../businesses/entities/business.entity';
import { BusinessMember } from '../../businesses/entities/business-member.entity';

export class StaffBusinessDto {
  businessId!: string;
  slug!: string;
  name!: string;
  role!: MemberRole;

  constructor(member: BusinessMember, business: Business) {
    this.businessId = business.id;
    this.slug = business.slug;
    this.name = business.name;
    this.role = member.role;
  }
}
