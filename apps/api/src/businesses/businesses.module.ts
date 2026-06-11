import { Global, Module, forwardRef } from '@nestjs/common';
import { BusinessesRepository } from './businesses.repository';
import { BusinessChatsRepository } from './business-chats.repository';
import { BusinessCustomersRepository } from './business-customers.repository';
import { BusinessMembersRepository } from './business-members.repository';
import { DefaultBusinessService } from './default-business.service';
import { BotTokenService } from './bot-token.service';
import { BusinessAdminService } from './business-admin.service';
import { BusinessAdminController } from './business-admin.controller';
import { BusinessAdminGuard } from '../auth/guards/business-admin.guard';
import { MenuModule } from '../menu/menu.module';
import { TelegramModule } from '../telegram/telegram.module';

/**
 * Тенантное ядро. @Global: businessId нужен guard'ам, боту и почти каждому домену —
 * без Global каждый модуль импортировал бы его явно (шум без пользы).
 */
@Global()
@Module({
  imports: [MenuModule, forwardRef(() => TelegramModule)],
  controllers: [BusinessAdminController],
  providers: [
    BusinessesRepository,
    BusinessChatsRepository,
    BusinessCustomersRepository,
    BusinessMembersRepository,
    DefaultBusinessService,
    BotTokenService,
    BusinessAdminService,
    BusinessAdminGuard,
  ],
  exports: [
    BusinessesRepository,
    BusinessChatsRepository,
    BusinessCustomersRepository,
    BusinessMembersRepository,
    DefaultBusinessService,
    BotTokenService,
    BusinessAdminService,
  ],
})
export class BusinessesModule {}
