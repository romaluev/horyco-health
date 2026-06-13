import { Body, Controller, Get, Post } from '@nestjs/common';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { SKIP_AUTH_WEBHOOK } from '../common/throttler/throttle-names';
import { Public } from '../common/decorators/public.decorator';
import { PlatformSetupService } from './platform-setup.service';
import { PlatformSetupDto, PlatformSetupStatusDto } from './dto/platform-setup.dto';
import { StaffLoginResponseDto } from '../auth/dto/staff-login-response.dto';

@Controller('platform')
export class PlatformSetupController {
  constructor(private readonly platformSetup: PlatformSetupService) {}

  @Public()
  @Get('setup-status')
  setupStatus(): Promise<PlatformSetupStatusDto> {
    return this.platformSetup.needsSetup().then((needsSetup) => new PlatformSetupStatusDto(needsSetup));
  }

  @Public()
  @SkipThrottle(SKIP_AUTH_WEBHOOK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('setup')
  createSetup(@Body() dto: PlatformSetupDto): Promise<StaffLoginResponseDto> {
    return this.platformSetup.setup(dto);
  }
}
