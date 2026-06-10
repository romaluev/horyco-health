import { Client } from '../../clients/entities/client.entity';
import { ClientResponseDto } from '../../clients/dto/client-response.dto';

export class AuthResponseDto {
  accessToken: string;
  client: ClientResponseDto;

  constructor(accessToken: string, client: Client) {
    this.accessToken = accessToken;
    this.client = new ClientResponseDto(client);
  }
}
