import {
  Allergens,
  Category,
  Ingredient,
  Language,
  Nutrition,
  OrderStatus,
  PaymentMethod,
  PricingMode,
  RecipeStep,
  Role,
  UnitKind,
} from '@eatfit/shared';

/** Зеркала response-DTO API (деньги — строки). Источник enum'ов — libs/shared. */

export interface ClientDto {
  id: string;
  telegramId: string;
  name: string;
  username: string | null;
  phone: string | null;
  address: string | null;
  deliveryLat: number | null;
  deliveryLng: number | null;
  language: Language;
  role: Role;
  balance: string;
  createdAt: string;
  ordersCount?: number;
  lastOrderAt?: string | null;
  lifetimeSpend?: string;
}

export interface MenuItemDto {
  id: string;
  category: Category;
  nameRu: string;
  nameUz: string;
  descriptionRu: string | null;
  descriptionUz: string | null;
  price: string;
  pricingMode: PricingMode;
  unitKind: UnitKind | null;
  unitStep: number | null;
  unitMin: number | null;
  unitMax: number | null;
  pricePerStep: string | null;
  unitDefault: number | null;
  hasPhoto: boolean;
  isActive: boolean;
  days: number[];
  weightGrams: number | null;
  price2: string | null;
  weightGrams2: number | null;
  orderDeadline: string | null;
  ingredients: Ingredient[] | null;
  allergens: Allergens | null;
  nutrition: Nutrition | null;
  nutrition2: Nutrition | null;
  instructions: RecipeStep[] | null;
  tipRu: string | null;
  tipUz: string | null;
  hasRequiredModifiers?: boolean;
  hasModifierGroups?: boolean;
  createdAt: string;
}

export interface CartItemDto {
  lineId: string;
  kind: 'dish' | 'combo';
  menuItemId: string | null;
  comboId: string | null;
  category: Category | null;
  nameRu: string;
  nameUz: string;
  price: string;
  quantity: number;
  lineTotal: string;
  portion: number;
  unitAmount: number | null;
  weightGrams: number | null;
  calories: number | null;
  modifiers: Array<{ id: string; nameRu: string; nameUz: string; priceDelta: string }>;
  comboSlots: Array<{
    slotId: string;
    slotNameRu: string;
    slotNameUz: string;
    menuItemId: string;
    itemNameRu: string;
    itemNameUz: string;
    surcharge: string;
  }>;
}

export interface CartDto {
  items: CartItemDto[];
  total: string;
  totalCalories: number | null;
}

export interface OrderItemDto {
  kind: 'dish' | 'combo';
  menuItemId: string | null;
  comboId: string | null;
  nameRu: string;
  nameUz: string;
  quantity: number;
  priceAtOrder: string;
  lineTotal: string;
  portion: number;
  unitAmount: number | null;
  weightGrams: number | null;
  calories: number | null;
  modifiers: Array<{ id: string; nameRu: string; nameUz: string; priceDelta: string }>;
  comboSlots: Array<{
    slotId: string;
    slotNameRu: string;
    itemNameRu: string;
    menuItemId: string;
  }>;
}

export interface OrderDto {
  id: string;
  number: number;
  status: OrderStatus;
  total: string;
  address: string;
  deliveryLat: number | null;
  deliveryLng: number | null;
  comment: string | null;
  paymentMethod: PaymentMethod;
  createdAt: string;
  customerName?: string | null;
  customerPhone?: string | null;
  items: OrderItemDto[];
  totalCalories: number | null;
}

export interface DepositDto {
  id: string;
  clientId: string;
  amount: string;
  adminTelegramId: string;
  createdAt: string;
}

export interface SettingsDto {
  topupTelegram: string | null;
  topupPhone: string | null;
  supportContact: string | null;
}

export interface AuthResponse {
  accessToken: string;
  client: ClientDto;
}
