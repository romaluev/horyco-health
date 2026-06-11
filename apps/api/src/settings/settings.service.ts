import { Injectable } from '@nestjs/common';
import { Business } from '../businesses/entities/business.entity';
import { BusinessesRepository } from '../businesses/businesses.repository';
import { DefaultBusinessService } from '../businesses/default-business.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { SettingsResponseDto } from './dto/settings-response.dto';

/** Ключи настроек (бывшие app_settings; теперь колонки businesses). */
export enum SettingKey {
  TopupTelegram = 'topup_telegram',
  TopupPhone = 'topup_phone',
  SupportContact = 'support_contact',
}

const KEY_TO_FIELD: Record<SettingKey, 'topupTelegram' | 'topupPhone' | 'supportContact'> = {
  [SettingKey.TopupTelegram]: 'topupTelegram',
  [SettingKey.TopupPhone]: 'topupPhone',
  [SettingKey.SupportContact]: 'supportContact',
};

/**
 * FR-S: настройки бизнеса (контакты пополнения, «Поддержка»). Единый источник для бота
 * и Mini App-админки; публичный контракт (get/set/view/update) сохранён при переезде
 * app_settings → колонки businesses (тенантность).
 */
@Injectable()
export class SettingsService {
  constructor(
    private readonly businesses: BusinessesRepository,
    private readonly defaultBusiness: DefaultBusinessService,
  ) {}

  private async load(): Promise<Business> {
    const id = await this.defaultBusiness.getId();
    const business = await this.businesses.findById(id);
    if (!business) {
      throw new Error('Бизнес не найден при чтении настроек');
    }
    return business;
  }

  async get(key: SettingKey): Promise<string | null> {
    return (await this.load())[KEY_TO_FIELD[key]];
  }

  async set(key: SettingKey, value: string): Promise<void> {
    const business = await this.load();
    business[KEY_TO_FIELD[key]] = value.trim();
    await this.businesses.save(business);
  }

  /** Текущие значения всех настроек (для админки/бота). */
  async view(): Promise<SettingsResponseDto> {
    const business = await this.load();
    return {
      topupTelegram: business.topupTelegram,
      topupPhone: business.topupPhone,
      supportContact: business.supportContact,
    };
  }

  /** Частичное обновление (только переданные поля). */
  async update(dto: UpdateSettingsDto): Promise<SettingsResponseDto> {
    const business = await this.load();
    if (dto.topupTelegram !== undefined) business.topupTelegram = dto.topupTelegram.trim();
    if (dto.topupPhone !== undefined) business.topupPhone = dto.topupPhone.trim();
    if (dto.supportContact !== undefined) business.supportContact = dto.supportContact.trim();
    await this.businesses.save(business);
    return {
      topupTelegram: business.topupTelegram,
      topupPhone: business.topupPhone,
      supportContact: business.supportContact,
    };
  }
}
