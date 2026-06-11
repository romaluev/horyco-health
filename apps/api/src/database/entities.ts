import { Business } from '../businesses/entities/business.entity';
import { BusinessMember } from '../businesses/entities/business-member.entity';
import { BusinessCustomer } from '../businesses/entities/business-customer.entity';
import { BusinessChat } from '../businesses/entities/business-chat.entity';
import { Client } from '../clients/entities/client.entity';
import { BalanceTransaction } from '../clients/balance/entities/balance-transaction.entity';
import { MenuItem } from '../menu/entities/menu-item.entity';
import { Order } from '../orders/entities/order.entity';
import { OrderItem } from '../orders/entities/order-item.entity';
import { Deposit } from '../deposits/entities/deposit.entity';
import { Offer, OfferRecipient } from '../offers/entities/offer.entity';
import {
  ModifierGroup,
  Modifier,
  MenuItemModifierGroup,
} from '../modifiers/entities/modifier.entity';
import {
  Combo,
  ComboSlot,
  ComboSlotOption,
  ComboModifierGroup,
} from '../combos/entities/combo.entity';

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
  Offer,
  OfferRecipient,
  ModifierGroup,
  Modifier,
  MenuItemModifierGroup,
  Combo,
  ComboSlot,
  ComboSlotOption,
  ComboModifierGroup,
];
