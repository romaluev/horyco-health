import { Language } from '@eatfit/shared';

/** 25000 → "25 000" (целые сумы). */
export function formatMoney(v: string | number): string {
  const n = Math.round(Number(v) || 0);
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** Локализованный выбор из ru/uz пары (названия/описания блюд). */
export function pick(lang: Language, ru?: string | null, uz?: string | null): string {
  return (lang === Language.Uz ? uz : ru) || ru || uz || '';
}
