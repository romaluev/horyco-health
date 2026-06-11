import { Client } from '../../clients/entities/client.entity';
import { Money } from '../../common/money/money';
import { ClientResponseDto } from '../../clients/dto/client-response.dto';
import { StaffBusinessDto } from './staff-business.dto';

export class StaffLoginResponseDto {
  accessToken!: string;
  client!: ClientResponseDto;
  businesses!: StaffBusinessDto[];

  constructor(
    accessToken: string,
    client: Client,
    balance: Money,
    businesses: StaffBusinessDto[],
  ) {
    this.accessToken = accessToken;
    this.client = new ClientResponseDto(client, balance);
    this.businesses = businesses;
  }
}
