import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { Role } from '@eatfit/shared';
import { Roles } from '../common/decorators/roles.decorator';
import { DepositsService } from './deposits.service';
import { CreateDepositDto } from './dto/create-deposit.dto';

@Controller()
export class DepositsController {
  constructor(private readonly deposits: DepositsService) {}

  /** История пополнений текущего клиента. */
  @Get('me/deposits')
  myHistory() {
    return this.deposits.myHistory();
  }

  /** Пополнение баланса админом. */
  @Roles(Role.Admin)
  @Post('admin/deposits')
  create(@Body() dto: CreateDepositDto) {
    return this.deposits.adminDeposit(dto);
  }

  /** Ручное списание с баланса админом. */
  @Roles(Role.Admin)
  @Post('admin/withdrawals')
  withdraw(@Body() dto: CreateDepositDto) {
    return this.deposits.adminWithdraw(dto);
  }

  /** История пополнений клиента (админ). */
  @Roles(Role.Admin)
  @Get('admin/clients/:id/deposits')
  clientHistory(@Param('id', ParseUUIDPipe) id: string) {
    return this.deposits.historyFor(id);
  }
}
