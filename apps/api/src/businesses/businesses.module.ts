import { Global, Module } from '@nestjs/common';
import { BusinessesRepository } from './businesses.repository';
import { BusinessCustomersRepository } from './business-customers.repository';
import { BusinessMembersRepository } from './business-members.repository';
import { DefaultBusinessService } from './default-business.service';

/**
 * Тенантное ядро. @Global: businessId нужен guard'ам, боту и почти каждому домену —
 * без Global каждый модуль импортировал бы его явно (шум без пользы).
 */
@Global()
@Module({
  providers: [
    BusinessesRepository,
    BusinessCustomersRepository,
    BusinessMembersRepository,
    DefaultBusinessService,
  ],
  exports: [
    BusinessesRepository,
    BusinessCustomersRepository,
    BusinessMembersRepository,
    DefaultBusinessService,
  ],
})
export class BusinessesModule {}
