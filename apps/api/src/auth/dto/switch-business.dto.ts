import { IsOptional, IsString, IsUUID, MaxLength, ValidateIf } from 'class-validator';

/** Переключение staff-сессии на другой бизнес (slug или uuid). */
export class SwitchBusinessDto {
  @ValidateIf((o: SwitchBusinessDto) => !o.businessId)
  @IsString()
  @MaxLength(64)
  biz?: string;

  @ValidateIf((o: SwitchBusinessDto) => !o.biz)
  @IsUUID()
  businessId?: string;
}
