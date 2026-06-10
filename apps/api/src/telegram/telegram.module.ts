import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClsService } from 'nestjs-cls';
import { TelegrafModule } from 'nestjs-telegraf';
import { NOTIFIER } from '../common/notifications/notifier';
import { ClientsModule } from '../clients/clients.module';
import { ClientRepository } from '../clients/clients.repository';
import { MenuModule } from '../menu/menu.module';
import { OrdersModule } from '../orders/orders.module';
import { DepositsModule } from '../deposits/deposits.module';
import { ReportsModule } from '../reports/reports.module';
import { SettingsModule } from '../settings/settings.module';
import { AppClsStore } from '../common/cls/actor-context';
import { TelegramNotifier } from './telegram-notifier';
import { MenuPublishService } from './menu-publish.service';
import { MenuPublishController } from './menu-publish.controller';
import { BotStateService } from './bot-state.service';
import { BotUiService } from './bot-ui.service';
import { BotStaffService } from './bot-staff.service';
import { BotMenuAdminService } from './bot-menu-admin.service';
import { BotCommandsService } from './bot-commands.service';
import { ClientUpdate } from './updates/client.update';
import { StaffUpdate } from './updates/staff.update';
import { createBotContextMiddleware } from './bot-context.middleware';

/**
 * FR-B: Telegram-бот (nestjs-telegraf). Бот — равноправный вход в домен наравне с REST.
 *
 * Запуск (AR-9): dev — long polling (по умолчанию); при BOT_ENABLED=false бот не получает
 * апдейты (launchOptions:false), но TelegramNotifier продолжает рассылать (sendMessage —
 * обычный вызов API, запуск не требуется) — это позволяет держать API-инстанс без бота.
 *
 * Глобальный модуль: предоставляет NOTIFIER, который уже инжектится в OrdersService /
 * DepositsService через @Optional() @Inject(NOTIFIER).
 */
@Global()
@Module({
  imports: [
    ClientsModule,
    MenuModule,
    OrdersModule,
    DepositsModule,
    ReportsModule,
    SettingsModule,
    TelegrafModule.forRootAsync({
      imports: [ClientsModule],
      inject: [ConfigService, ClsService, ClientRepository],
      useFactory: (
        config: ConfigService,
        cls: ClsService<AppClsStore>,
        clients: ClientRepository,
      ) => ({
        token: config.get<string>('bot.token') as string,
        // Авто-запуск выключаем ВСЕГДА: nestjs-telegraf зовёт bot.launch() без catch, и его
        // reject (например 409 при втором polling) становится unhandledRejection и роняет
        // процесс (Node ≥15). Бота запускаем сами в BotCommandsService с обработкой ошибки.
        launchOptions: false,
        // CLS+actor контекст для каждого апдейта — до выполнения хендлеров.
        middlewares: [createBotContextMiddleware(cls, clients, config)],
      }),
    }),
  ],
  controllers: [MenuPublishController],
  providers: [
    TelegramNotifier,
    { provide: NOTIFIER, useExisting: TelegramNotifier },
    MenuPublishService,
    BotStateService,
    BotUiService,
    BotStaffService,
    BotMenuAdminService,
    BotCommandsService,
    ClientUpdate,
    StaffUpdate,
  ],
  exports: [NOTIFIER],
})
export class TelegramModule {}
