import { Module } from '@nestjs/common';
import { PlatformController } from './platform.controller';
import { PlatformService } from './platform.service';
import { PlatformGuard } from '../auth/guards/platform.guard';
import { TelegramModule } from '../telegram/telegram.module';

@Module({
  imports: [TelegramModule],
  controllers: [PlatformController],
  providers: [PlatformService, PlatformGuard],
})
export class PlatformModule {}
