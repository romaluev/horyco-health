import { Injectable } from '@nestjs/common';
import { SettingsRepository } from './settings.repository';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { SettingsResponseDto } from './dto/settings-response.dto';

/** Ключи настроек приложения (app_settings). */
export enum SettingKey {
  TopupTelegram = 'topup_telegram',
  TopupPhone = 'topup_phone',
  SupportContact = 'support_contact',
}

/**
 * FR-S: настройки приложения (контакты пополнения, назначение «Поддержки»).
 * Единый источник для бота и Mini App-админки; чтение и изменение — только админ.
 */
@Injectable()
export class SettingsService {
  constructor(private readonly repo: SettingsRepository) {}

  async get(key: SettingKey): Promise<string | null> {
    const s = await this.repo.get(key);
    return s?.value ?? null;
  }

  async set(key: SettingKey, value: string): Promise<void> {
    await this.repo.set(key, value.trim());
  }

  /** Текущие значения всех настроек (для админки/бота). */
  async view(): Promise<SettingsResponseDto> {
    const map = new Map((await this.repo.findAll()).map((s) => [s.key, s.value]));
    return {
      topupTelegram: map.get(SettingKey.TopupTelegram) ?? null,
      topupPhone: map.get(SettingKey.TopupPhone) ?? null,
      supportContact: map.get(SettingKey.SupportContact) ?? null,
    };
  }

  /** Частичное обновление (только переданные поля). */
  async update(dto: UpdateSettingsDto): Promise<SettingsResponseDto> {
    if (dto.topupTelegram !== undefined) await this.set(SettingKey.TopupTelegram, dto.topupTelegram);
    if (dto.topupPhone !== undefined) await this.set(SettingKey.TopupPhone, dto.topupPhone);
    if (dto.supportContact !== undefined) await this.set(SettingKey.SupportContact, dto.supportContact);
    return this.view();
  }
}
