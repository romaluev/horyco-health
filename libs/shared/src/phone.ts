/** Нормализация телефона для хранения и поиска (UZ: +998…). */
export function normalizePhone(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 7) return trimmed;
  if (digits.startsWith('998')) return `+${digits}`;
  if (digits.length === 9) return `+998${digits}`;
  return trimmed.startsWith('+') ? `+${digits}` : `+${digits}`;
}

/** Варианты для поиска legacy-записей без «+». */
export function phoneLookupVariants(raw: string): string[] {
  const normalized = normalizePhone(raw);
  const digits = normalized.replace(/\D/g, '');
  return [...new Set([normalized, digits, `+${digits}`, raw.trim()].filter(Boolean))];
}
