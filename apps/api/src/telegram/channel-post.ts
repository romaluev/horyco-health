import { Markup } from 'telegraf';
import { MenuItem } from '../menu/entities/menu-item.entity';
import { Lang, t } from './i18n/bot-i18n';
import { channelComboPostLines, channelDishPostLines } from './message-formatters';

/**
 * Пост блюда для канала — общий источник для бота (StaffUpdate) и публикации с сайта
 * (MenuPublishService). Текст двуязычный (ru + uz), под постом — deep-link «Заказать».
 */

/** Двуязычный текст поста блюда (канал публичный для обеих аудиторий). */
export function channelPostText(item: MenuItem): string {
  return channelDishPostLines(item).join('\n');
}

/**
 * Inline-кнопки под постом в канал (если задан BOT_USERNAME): «Заказать» (deep link — запуск +
 * добавление в корзину) и «Подробнее» (deep link на /start detail_<id> — бот открывает деталь
 * блюда через web_app-кнопку в личке). В КАНАЛЕ ?startapp= требует настроенного Mini App в
 * BotFather и иначе даёт «bot invalid», поэтому используем обычный ?start= (всегда работает).
 */
export function orderDeepLinkButton(item: MenuItem, lang: Lang, botUsername?: string) {
  if (!botUsername) return {};
  const orderUrl = `https://t.me/${botUsername}?start=item_${item.id}`;
  const detailUrl = `https://t.me/${botUsername}?start=detail_${item.id}`;
  return Markup.inlineKeyboard([
    [Markup.button.url(t(lang, 'post_order_btn'), orderUrl)],
    [Markup.button.url(t(lang, 'btn_details'), detailUrl)],
  ]);
}

/** Фото для поста: загруженный файл недоступен боту по URL → отдаём file_id/внешний URL, иначе null. */
export function channelPostPhoto(item: MenuItem): string | null {
  return item.photoFileId || item.photoUrl || null;
}

/** Двуязычный текст поста комбо в канал. */
export function channelPostComboText(combo: {
  nameRu: string;
  nameUz: string;
  price: { toString(): string };
  originalPrice?: { toString(): string } | null;
}): string {
  return channelComboPostLines(combo).join('\n');
}

/** Inline-кнопки под постом комбо: deep link ?start=combo_<id>. */
export function comboDeepLinkButton(
  comboId: string,
  lang: Lang,
  botUsername?: string,
) {
  if (!botUsername) return {};
  const orderUrl = `https://t.me/${botUsername}?start=combo_${comboId}`;
  return Markup.inlineKeyboard([[Markup.button.url(t(lang, 'post_order_btn'), orderUrl)]]);
}
