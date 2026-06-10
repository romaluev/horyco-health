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
