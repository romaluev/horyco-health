import { IsEnum, IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';
import { Language } from '@eatfit/shared';

export class UpdateBusinessSettingsDto {
  @IsOptional()
  @IsString()
  topupTelegram?: string;

  @IsOptional()
  @IsString()
  topupPhone?: string;

  @IsOptional()
  @IsString()
  supportContact?: string;

  @IsOptional()
  @IsEnum(Language)
  languageDefault?: Language;

  @IsOptional()
  @IsInt()
  @Min(-12)
  @Max(14)
  tzOffsetHours?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  dailyReportHour?: number;
}
