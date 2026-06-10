import { IsOptional, IsString, MaxLength } from 'class-validator';

/** Частичное обновление настроек (любое подмножество полей). */
export class UpdateSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  topupTelegram?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  topupPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  supportContact?: string;
}
