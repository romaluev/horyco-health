import { IsIn, IsOptional } from 'class-validator';

export class AnalyticsQueryDto {
  @IsOptional()
  @IsIn(['today', '7d', '30d'])
  range?: 'today' | '7d' | '30d';
}
