import { BotStatus, BusinessStatus } from '@eatfit/shared';
import { Business } from '../../businesses/entities/business.entity';

export class BusinessListItemDto {
  id!: string;
  slug!: string;
  name!: string;
  status!: BusinessStatus;
  botStatus!: BotStatus;
  botUsername!: string | null;
  createdAt!: Date;

  constructor(b: Business) {
    this.id = b.id;
    this.slug = b.slug;
    this.name = b.name;
    this.status = b.status;
    this.botStatus = b.botStatus;
    this.botUsername = b.botUsername;
    this.createdAt = b.createdAt;
  }
}
