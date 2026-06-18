import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateAdminClientDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsString()
  @MinLength(5)
  @MaxLength(32)
  phone!: string;

  /** Full text delivery address (optional for CRM stub). */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;
}
