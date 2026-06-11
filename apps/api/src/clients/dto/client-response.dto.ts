import { Language, Role } from '@eatfit/shared';
import { Client } from '../entities/client.entity';
import { Money } from '../../common/money/money';

/**
 * Response-DTO клиента — белый список полей (по построению). Сущность из контроллера
 * не возвращаем. balance — строка (Money), не number. Баланс передаётся снаружи
 * (из кошелька business_customers), т.к. Client сам по себе его не хранит.
 */
export class ClientResponseDto {
  id: string;
  telegramId: string | null;
  name: string;
  username: string | null;
  phone: string | null;
  address: string | null;
  deliveryLat: number | null;
  deliveryLng: number | null;
  language: Language;
  role: Role;
  balance: string;
  createdAt: Date;

  constructor(c: Client, balance: Money) {
    this.id = c.id;
    this.telegramId = c.telegramId;
    this.name = c.name;
    this.username = c.username;
    this.phone = c.phone;
    this.address = c.address;
    this.deliveryLat = parseCoord(c.deliveryLat);
    this.deliveryLng = parseCoord(c.deliveryLng);
    this.language = c.language;
    this.role = c.role;
    this.balance = balance.toString();
    this.createdAt = c.createdAt;
  }
}

function parseCoord(v: string | null | undefined): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
