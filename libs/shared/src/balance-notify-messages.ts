import { Language } from './enums';

export function balanceDepositClientMessage(lang: Language, amount: string, balance: string): string {
  return lang === Language.Uz
    ? `Balansingiz ${amount} ga to‘ldirildi. Joriy balans: ${balance}.`
    : `Ваш баланс пополнен на ${amount}. Текущий баланс: ${balance}.`;
}

export function balanceWithdrawClientMessage(lang: Language, amount: string, balance: string): string {
  return lang === Language.Uz
    ? `Balansingizdan ${amount} yechildi. Joriy balans: ${balance}.`
    : `С вашего баланса списано ${amount}. Текущий баланс: ${balance}.`;
}

export function balanceDepositAdminMessage(name: string, amount: string, balance: string): string {
  return `Пополнение: ${name} (+${amount}). Баланс: ${balance}.`;
}

export function balanceWithdrawAdminMessage(name: string, amount: string, balance: string): string {
  return `Списание: ${name} (−${amount}). Баланс: ${balance}.`;
}
