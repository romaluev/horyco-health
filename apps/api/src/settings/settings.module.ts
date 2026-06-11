import { Module } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { SettingsController } from './settings.controller';

/** FR-S: настройки приложения. Экспортирует SettingsService для бота. */
@Module({
  controllers: [SettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
