/** Снимок настроек приложения (null — не задано). */
export class SettingsResponseDto {
  topupTelegram!: string | null;
  topupPhone!: string | null;
  supportContact!: string | null;
}
