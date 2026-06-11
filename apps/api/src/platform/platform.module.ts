import { Module } from '@nestjs/common';
import { PlatformController } from './platform.controller';
import { PlatformSetupController } from './platform-setup.controller';
import { PlatformService } from './platform.service';
import { PlatformSetupService } from './platform-setup.service';
import { PlatformGuard } from '../auth/guards/platform.guard';
import { AuthModule } from '../auth/auth.module';
import { TelegramModule } from '../telegram/telegram.module';

@Module({
  imports: [TelegramModule, AuthModule],
  controllers: [PlatformController, PlatformSetupController],
  providers: [PlatformService, PlatformSetupService, PlatformGuard],
})
export class PlatformModule {}
