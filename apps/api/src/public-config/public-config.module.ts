import { Module } from '@nestjs/common';
import { PublicConfigController } from './public-config.controller';

@Module({
  controllers: [PublicConfigController],
  // BusinessesRepository + DefaultBusinessService — @Global из BusinessesModule.
})
export class PublicConfigModule {}
