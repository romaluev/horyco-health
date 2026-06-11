import { IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';

export class UpdateBusinessDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

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
