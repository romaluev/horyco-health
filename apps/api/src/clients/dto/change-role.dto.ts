import { IsEnum } from 'class-validator';
import { Role } from '@eatfit/shared';

export class ChangeRoleDto {
  @IsEnum(Role)
  role!: Role;
}
