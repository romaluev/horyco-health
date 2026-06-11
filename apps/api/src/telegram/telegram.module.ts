import { Global, Module, forwardRef } from '@nestjs/common';
import { NOTIFIER } from '../common/notifications/notifier';
import { ClientsModule } from '../clients/clients.module';
import { MenuModule } from '../menu/menu.module';
import { OrdersModule } from '../orders/orders.module';
import { ModifiersModule } from '../modifiers/modifiers.module';
import { CombosModule } from '../combos/combos.module';
import { OffersModule } from '../offers/offers.module';
import { DepositsModule } from '../deposits/deposits.module';
import { ReportsModule } from '../reports/reports.module';
import { SettingsModule } from '../settings/settings.module';
import { TelegramNotifier } from './telegram-notifier';
import { MenuPublishService } from './menu-publish.service';
import { MenuPublishController } from './menu-publish.controller';
import { BotStateService } from './bot-state.service';
import { BotUiService } from './bot-ui.service';
import { BotStaffService } from './bot-staff.service';
import { BotMenuAdminService } from './bot-menu-admin.service';
import { ClientUpdate } from './updates/client.update';
import { StaffUpdate } from './updates/staff.update';
import { BotRegistryService } from './engine/bot-registry.service';
import { BotComposerFactory } from './engine/bot-composer.factory';
import { BotLifecycleService } from './engine/bot-lifecycle.service';
import { BotHealthService } from './engine/bot-health.service';
import { TelegramWebhookController } from './engine/telegram-webhook.controller';
import { UpdateDedupeService } from './engine/update-dedupe.service';
import { BroadcastService } from './broadcast.service';

@Global()
@Module({
  imports: [
    ClientsModule,
    MenuModule,
    OrdersModule,
    ModifiersModule,
    CombosModule,
    forwardRef(() => OffersModule),
    DepositsModule,
    ReportsModule,
    SettingsModule,
  ],
  controllers: [MenuPublishController, TelegramWebhookController],
  providers: [
    TelegramNotifier,
    { provide: NOTIFIER, useExisting: TelegramNotifier },
    MenuPublishService,
    BotStateService,
    BotUiService,
    BotStaffService,
    BotMenuAdminService,
    ClientUpdate,
    StaffUpdate,
    BotComposerFactory,
    BotRegistryService,
    BotLifecycleService,
    BotHealthService,
    UpdateDedupeService,
    BroadcastService,
  ],
  exports: [NOTIFIER, BotRegistryService, BotHealthService, BotLifecycleService, BroadcastService],
})
export class TelegramModule {}
