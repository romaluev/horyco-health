import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class TelegramAuthDto {
  @IsString()
  @IsNotEmpty()
  initData!: string;

  // Slug бизнеса (?biz= в Mini App). Опционален до полного перехода на мультибот.
  @IsOptional()
  @IsString()
  @MaxLength(64)
  biz?: string;
}
