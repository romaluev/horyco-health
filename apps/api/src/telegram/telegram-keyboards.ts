import { Markup } from 'telegraf';
import { InlineKeyboardButton } from 'telegraf/typings/core/types/typegram';
import { Role } from '@eatfit/shared';
import { Lang, t } from './i18n/bot-i18n';

/**
 * Сборка reply- и inline-клавиатур через telegraf Markup (типобезопасно) с учётом языка
 * и роли (паритет src/keyboards.js). Чистые функции; конфиг (web app url) — параметром.
 */

/** Reply-клавиатура главного меню с учётом роли. */
export function mainMenuKeyboard(lang: Lang, role: Role, isAdmin: boolean, webAppUrl?: string) {
  const rows = [
    [Markup.button.text(t(lang, 'btn_make_order'))],
    [Markup.button.text(t(lang, 'btn_my_orders')), Markup.button.text(t(lang, 'btn_profile'))],
    [Markup.button.text(t(lang, 'btn_balance')), Markup.button.text(t(lang, 'btn_support'))],
  ];
  // Telegram принимает Web App-кнопки только по HTTPS — для локалки (http/localhost) скрываем.
  if (webAppUrl && webAppUrl.startsWith('https://')) {
    rows.push([Markup.button.webApp(t(lang, 'btn_webapp'), webAppUrl)]);
  }
  if (role === Role.Cook) rows.push([Markup.button.text(t(lang, 'btn_cook_mode'))]);
  if (role === Role.Courier) rows.push([Markup.button.text(t(lang, 'btn_courier_mode'))]);
  if (isAdmin) rows.push([Markup.button.text(t(lang, 'btn_admin_panel'))]);
  return Markup.keyboard(rows).resize();
}

/** Inline-клавиатура выбора языка. */
export function languageKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('🇷🇺 Русский', 'lang:ru'),
      Markup.button.callback("🇺🇿 O'zbek", 'lang:uz'),
    ],
  ]);
}

/** Reply-клавиатура «Поделиться контактом». */
export function shareContactKeyboard(lang: Lang) {
  return Markup.keyboard([[Markup.button.contactRequest(t(lang, 'share_contact'))]])
    .resize()
    .oneTime();
}

/** Inline-кнопки добавления блюда из карточки (deep link). */
export function dishCardKeyboard(lang: Lang, itemId: string) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(t(lang, 'btn_add_to_cart'), `cart:add:${itemId}`),
      Markup.button.callback(t(lang, 'btn_decline'), 'cart:decline'),
    ],
  ]);
}

/** Inline-меню «добавить ещё / напитки / десерты / оформить». */
export function addMoreKeyboard(lang: Lang) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(t(lang, 'btn_drinks'), 'cart:cat:drink'),
      Markup.button.callback(t(lang, 'btn_desserts'), 'cart:cat:dessert'),
    ],
    [Markup.button.callback(t(lang, 'btn_checkout'), 'cart:checkout')],
  ]);
}

/**
 * Ряд-степпер под блюдом для выбранной порции: ➖ / количество / ➕ (средняя — индикатор).
 * portion (1 — обычная, 2 — вторая порция со своей ценой) идёт в callback, чтобы степпер
 * правил именно выбранную порцию (активную в карточке).
 */
export function stepperRow(
  lang: Lang,
  itemId: string,
  qty: number,
  portion = 1,
): InlineKeyboardButton[] {
  return [
    Markup.button.callback('➖', `qty:dec:${itemId}:${portion}`),
    Markup.button.callback(`${qty} ${t(lang, 'pcs')}`, 'qty:noop'),
    Markup.button.callback('➕', `qty:inc:${itemId}:${portion}`),
  ];
}

/**
 * Ряд-кнопка «Подробнее» под степпером: web_app, открывает деталь блюда в Mini App (?dish=<id>).
 * Telegram принимает web_app-кнопки только по HTTPS — без https-URL ряд не добавляем (null).
 */
export function detailButtonRow(
  lang: Lang,
  itemId: string,
  webAppUrl?: string,
): InlineKeyboardButton[] | null {
  if (!webAppUrl || !webAppUrl.startsWith('https://')) return null;
  const sep = webAppUrl.includes('?') ? '&' : '?';
  const url = `${webAppUrl}${sep}dish=${encodeURIComponent(itemId)}`;
  return [Markup.button.webApp(t(lang, 'btn_details'), url)];
}
