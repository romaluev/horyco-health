import { BusinessListItemDto } from './business-list-item.dto';

export class CreateBusinessOwnerDto {
  name!: string;
  phone!: string;
  existingAccount!: boolean;

  constructor(name: string, phone: string, existingAccount: boolean) {
    this.name = name;
    this.phone = phone;
    this.existingAccount = existingAccount;
  }
}

export class CreateBusinessResultDto {
  business!: BusinessListItemDto;
  owner!: CreateBusinessOwnerDto;
  loginUrl!: string;

  constructor(business: BusinessListItemDto, owner: CreateBusinessOwnerDto, loginUrl: string) {
    this.business = business;
    this.owner = owner;
    this.loginUrl = loginUrl;
  }
}
