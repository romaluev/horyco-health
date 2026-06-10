import { Module } from '@nestjs/common';
import { ClientRepository } from './clients.repository';
import { ClientsService } from './clients.service';
import { ClientsController } from './clients.controller';
import { ClientsAdminController } from './admin/clients-admin.controller';
import { BalanceRepository } from './balance/balance.repository';
import { BalanceService } from './balance/balance.service';

/**
 * Клиенты: профиль (/me), админ-управление (/admin/clients) и денежное ядро
 * (BalanceService + ledger). BalanceService/ClientRepository экспортируются для
 * Deposits и Orders.
 */
@Module({
  controllers: [ClientsController, ClientsAdminController],
  providers: [ClientRepository, ClientsService, BalanceRepository, BalanceService],
  exports: [ClientRepository, BalanceService],
})
export class ClientsModule {}
