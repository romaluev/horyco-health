import { IsEnum, IsString, MinLength } from 'class-validator';
import { MemberRole } from '@eatfit/shared';

export class InviteStaffDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  @MinLength(5)
  phone!: string;

  @IsEnum(MemberRole)
  role!: MemberRole;
}

export class UpdateStaffDto {
  @IsEnum(MemberRole)
  role!: MemberRole;
}
