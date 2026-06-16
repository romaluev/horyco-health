// Общие перечисления домена Eat&fit (используются и API, и фронтом).

export enum Role {
  Client = 'client',
  Cook = 'cook',
  Courier = 'courier',
  Admin = 'admin',
}

export enum OrderStatus {
  Pending = 'pending',
  Confirmed = 'confirmed',
  Cooking = 'cooking',
  Ready = 'ready', // приготовлено, ожидает курьера
  Delivering = 'delivering',
  Done = 'done',
  Cancelled = 'cancelled',
}

export enum Category {
  Main = 'main',
  Drink = 'drink',
  Dessert = 'dessert',
}

/** Режим ценообразования блюда: фиксированная цена или за единицу (вес/штуки). */
export enum PricingMode {
  Fixed = 'fixed',
  PerUnit = 'per_unit',
}

/** Единица измерения для per_unit: граммы или штуки. */
export enum UnitKind {
  Gram = 'gram',
  Piece = 'piece',
}

export enum Language {
  Ru = 'ru',
  Uz = 'uz',
}

// Способ оплаты заказа: с баланса клиента или при получении.
export enum PaymentMethod {
  Balance = 'balance',
  OnDelivery = 'on_delivery',
}

// Тип движения по балансу (append-only ledger).
export enum BalanceTransactionType {
  Deposit = 'deposit', // пополнение админом (+)
  OrderCharge = 'order_charge', // списание за заказ (−)
  OrderRefund = 'order_refund', // возврат при отмене (+)
  AdminDebit = 'admin_debit', // ручное списание админом (−)
}

// ── Мультитенантность (B2B2C платформа) ──

// Статус бизнеса (тенанта): онбординг → активен ↔ приостановлен.
export enum BusinessStatus {
  Onboarding = 'onboarding',
  Active = 'active',
  Suspended = 'suspended',
}

// Состояние подключения бота бизнеса.
export enum BotStatus {
  Off = 'off',
  Webhook = 'webhook',
  Polling = 'polling',
  Error = 'error',
  Revoked = 'revoked',
}

// Роль участника бизнеса (staff). Маппинг на легаси Role:
// owner/manager → Admin, cook → Cook, courier → Courier.
export enum MemberRole {
  Owner = 'owner',
  Manager = 'manager',
  Cook = 'cook',
  Courier = 'courier',
}

export enum MemberStatus {
  Invited = 'invited',
  Active = 'active',
  Removed = 'removed',
}

// Статус клиента в CRM конкретного бизнеса.
export enum BusinessCustomerStatus {
  Active = 'active',
  Blocked = 'blocked',
}

// Назначение привязанного чата бизнеса.
export enum ChatKind {
  Cook = 'cook',
  Courier = 'courier',
  Admin = 'admin',
  Channel = 'channel',
}

export enum ChatStatus {
  Active = 'active',
  Broken = 'broken',
}
