import { BotStatus, BusinessStatus, Language } from '@eatfit/shared';

export class BusinessSettingsResponseDto {
  name!: string;
  slug!: string;
  status!: BusinessStatus;
  botStatus!: BotStatus;
  botUsername!: string | null;
  hasBotToken!: boolean;
  topupTelegram!: string | null;
  topupPhone!: string | null;
  supportContact!: string | null;
  languageDefault!: Language;
  tzOffsetHours!: number;
  dailyReportHour!: number;
}
