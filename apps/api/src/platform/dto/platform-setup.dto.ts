import { IsString, MinLength } from 'class-validator';

export class PlatformSetupDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  @MinLength(5)
  phone!: string;

  @IsString()
  @MinLength(6)
  password!: string;
}

export class PlatformSetupStatusDto {
  needsSetup!: boolean;

  constructor(needsSetup: boolean) {
    this.needsSetup = needsSetup;
  }
}
