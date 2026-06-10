import { Deposit } from '../entities/deposit.entity';

export class DepositResponseDto {
  id: string;
  clientId: string;
  amount: string;
  adminTelegramId: string;
  createdAt: Date;

  constructor(d: Deposit) {
    this.id = d.id;
    this.clientId = d.clientId;
    this.amount = d.amount.toString();
    this.adminTelegramId = d.adminTelegramId;
    this.createdAt = d.createdAt;
  }
}
