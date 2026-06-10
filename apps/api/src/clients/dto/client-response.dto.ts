import { Language, Role } from '@eatfit/shared';
import { Client } from '../entities/client.entity';

/**
 * Response-DTO клиента — белый список полей (по построению). Сущность из контроллера
 * не возвращаем. balance — строка (Money), не number.
 */
export class ClientResponseDto {
  id: string;
  telegramId: string | null;
  name: string;
  username: string | null;
  phone: string | null;
  address: string | null;
  language: Language;
  role: Role;
  balance: string;
  createdAt: Date;

  constructor(c: Client) {
    this.id = c.id;
    this.telegramId = c.telegramId;
    this.name = c.name;
    this.username = c.username;
    this.phone = c.phone;
    this.address = c.address;
    this.language = c.language;
    this.role = c.role;
    this.balance = c.balance.toString();
    this.createdAt = c.createdAt;
  }
}
