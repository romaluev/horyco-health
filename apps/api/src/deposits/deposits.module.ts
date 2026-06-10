import { Module } from '@nestjs/common';
import { ClientsModule } from '../clients/clients.module';
import { DepositRepository } from './deposit.repository';
import { DepositsService } from './deposits.service';
import { DepositsController } from './deposits.controller';

@Module({
  imports: [ClientsModule], // BalanceService + ClientRepository
  controllers: [DepositsController],
  providers: [DepositRepository, DepositsService],
  exports: [DepositsService], // для Telegram-бота (FR-D1)
})
export class DepositsModule {}
