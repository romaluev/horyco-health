import { Language, Role } from '@eatfit/shared';
import { Client } from '../entities/client.entity';
import { Money } from '../../common/money/money';

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

export class ClientCrmListItemDto extends ClientResponseDto {
  ordersCount: number;
  lastOrderAt: Date | null;
  lifetimeSpend: string;

  constructor(
    c: Client,
    balance: Money,
    stats: { ordersCount: number; lastOrderAt: Date | null; lifetimeSpend: Money },
  ) {
    super(c, balance);
    this.ordersCount = stats.ordersCount;
    this.lastOrderAt = stats.lastOrderAt;
    this.lifetimeSpend = stats.lifetimeSpend.toString();
  }
}

export class ClientTopItemDto {
  name!: string;
  quantity!: number;
}

export class ClientCrmDetailDto extends ClientCrmListItemDto {
  topItems: ClientTopItemDto[];

  constructor(
    c: Client,
    balance: Money,
    stats: { ordersCount: number; lastOrderAt: Date | null; lifetimeSpend: Money },
    topItems: ClientTopItemDto[],
  ) {
    super(c, balance, stats);
    this.topItems = topItems;
  }
}

function parseCoord(v: string | null | undefined): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
