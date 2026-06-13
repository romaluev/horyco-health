import { Global, Module, forwardRef } from '@nestjs/common';
import { ClientRepository } from './clients.repository';
import { ClientsService } from './clients.service';
import { ClientsController } from './clients.controller';
import { ClientsAdminController } from './admin/clients-admin.controller';
import { BalanceRepository } from './balance/balance.repository';
import { BalanceService } from './balance/balance.service';
import { AnalyticsModule } from '../analytics/analytics.module';
import { OrdersModule } from '../orders/orders.module';

/**
 * Клиенты: профиль (/me), админ-управление (/admin/clients) и денежное ядро
 * (BalanceService + ledger). BalanceService/ClientRepository экспортируются для
 * Deposits и Orders. @Global: ClientRepository нужен guard'ам (re-validate isPlatformAdmin),
 * которые инстанцируются в контексте чужих модулей.
 */
@Global()
@Module({
  imports: [AnalyticsModule, forwardRef(() => OrdersModule)],
  controllers: [ClientsController, ClientsAdminController],
  providers: [ClientRepository, ClientsService, BalanceRepository, BalanceService],
  exports: [ClientRepository, BalanceService, ClientsService],
})
export class ClientsModule {}
