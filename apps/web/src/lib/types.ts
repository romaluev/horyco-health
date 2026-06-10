import {
  Allergens,
  Category,
  Ingredient,
  Language,
  Nutrition,
  OrderStatus,
  PaymentMethod,
  Role,
} from '@eatfit/shared';

/** Зеркала response-DTO API (деньги — строки). Источник enum'ов — libs/shared. */

export interface ClientDto {
  id: string;
  telegramId: string;
  name: string;
  username: string | null;
  phone: string | null;
  address: string | null;
  language: Language;
  role: Role;
  balance: string;
  createdAt: string;
}

export interface MenuItemDto {
  id: string;
  category: Category;
  nameRu: string;
  nameUz: string;
  descriptionRu: string | null;
  descriptionUz: string | null;
  price: string;
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
  createdAt: string;
}

export interface CartItemDto {
  menuItemId: string;
  category: Category;
  nameRu: string;
  nameUz: string;
  price: string;
  quantity: number;
  lineTotal: string;
  portion: number;
  weightGrams: number | null;
  calories: number | null;
}

export interface CartDto {
  items: CartItemDto[];
  total: string;
  totalCalories: number | null;
}

export interface OrderItemDto {
  menuItemId: string;
  nameRu: string;
  nameUz: string;
  quantity: number;
  priceAtOrder: string;
  lineTotal: string;
  portion: number;
  weightGrams: number | null;
  calories: number | null;
}

export interface OrderDto {
  id: string;
  number: number;
  status: OrderStatus;
  total: string;
  address: string;
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
