import { Client } from '../clients/entities/client.entity';
import { BalanceTransaction } from '../clients/balance/entities/balance-transaction.entity';
import { MenuItem } from '../menu/entities/menu-item.entity';
import { Order } from '../orders/entities/order.entity';
import { OrderItem } from '../orders/entities/order-item.entity';
import { Deposit } from '../deposits/entities/deposit.entity';
import { AppSetting } from '../settings/entities/app-setting.entity';

// Единый список сущностей домена (регистрируется для autoLoad/synchronize).
export const ENTITIES = [
  Client,
  BalanceTransaction,
  MenuItem,
  Order,
  OrderItem,
  Deposit,
  AppSetting,
];
