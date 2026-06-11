import { Client } from '../clients/entities/client.entity';
import { BalanceTransaction } from '../clients/balance/entities/balance-transaction.entity';
import { MenuItem } from '../menu/entities/menu-item.entity';
import { Order } from '../orders/entities/order.entity';
import { OrderItem } from '../orders/entities/order-item.entity';
import { Deposit } from '../deposits/entities/deposit.entity';
import { Business } from '../businesses/entities/business.entity';
import { BusinessMember } from '../businesses/entities/business-member.entity';
import { BusinessCustomer } from '../businesses/entities/business-customer.entity';
import { BusinessChat } from '../businesses/entities/business-chat.entity';

// Единый список сущностей домена (регистрируется для autoLoad/synchronize).
export const ENTITIES = [
  Business,
  BusinessMember,
  BusinessCustomer,
  BusinessChat,
  Client,
  BalanceTransaction,
  MenuItem,
  Order,
  OrderItem,
  Deposit,
];
