import { IsInt, IsOptional, IsString, Matches, Max, Min, MinLength } from 'class-validator';

export class CreateBusinessDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  @Matches(/^[a-z0-9-]+$/, { message: 'slug: только a-z, 0-9 и дефис' })
  slug!: string;

  @IsString()
  @MinLength(2)
  ownerName!: string;

  @IsString()
  @MinLength(5)
  ownerPhone!: string;

  @IsString()
  @MinLength(6)
  ownerPassword!: string;

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
