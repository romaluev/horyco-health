/**
 * Текущий день недели в формате ISO (1=Пн … 7=Вс) с учётом смещения часового пояса
 * приложения (часы). Единый источник для фильтрации витрины по дню (меню сайта и бота).
 */
export function currentIsoWeekday(tzOffsetHours: number): number {
  const local = new Date(Date.now() + tzOffsetHours * 3_600_000);
  const dow = local.getUTCDay(); // 0=Вс … 6=Сб
  return dow === 0 ? 7 : dow; // → ISO 1=Пн … 7=Вс
}
