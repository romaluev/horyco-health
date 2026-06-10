import { IsOptional, IsString } from 'class-validator';

export class ClientSearchQueryDto {
  @IsOptional()
  @IsString()
  query?: string;
}
