import { Markup } from 'telegraf';
import { InlineKeyboardButton } from 'telegraf/typings/core/types/typegram';
import { Role } from '@eatfit/shared';
import { Lang, t } from './i18n/bot-i18n';
import { formatCustomerPhone } from './message-formatters';

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

/** Reply-клавиатура «Отправить локацию». */
export function shareLocationKeyboard(lang: Lang) {
  return Markup.keyboard([[Markup.button.locationRequest(t(lang, 'share_location'))]]).resize();
}

/** Пропустить ввод ориентира после локации. */
export function skipLandmarkKeyboard(lang: Lang) {
  return Markup.inlineKeyboard([[Markup.button.callback(t(lang, 'btn_skip_landmark'), 'reg:skip_landmark')]]);
}

/** Кнопки в push-уведомлениях о заказе. */
export function orderNotifyKeyboard(lang: Lang, webAppUrl?: string) {
  const rows: InlineKeyboardButton[][] = [
    [Markup.button.callback(t(lang, 'btn_my_orders_short'), 'nav:orders')],
  ];
  if (webAppUrl?.startsWith('https://')) {
    rows.push([Markup.button.webApp(t(lang, 'btn_webapp'), webAppUrl)]);
  }
  return Markup.inlineKeyboard(rows);
}

/** URL-кнопка «Открыть на карте» для карточек заказа. */
export function mapsLinkButton(lang: Lang, lat: number, lng: number): InlineKeyboardButton {
  return Markup.button.url(t(lang, 'btn_open_maps'), `https://maps.google.com/?q=${lat},${lng}`);
}

/** Callback-кнопка «Позвонить клиенту» (tel: недоступен в inline URL). */
export function callCustomerButton(lang: Lang, phone: string): InlineKeyboardButton | null {
  const normalized = formatCustomerPhone(phone);
  if (!normalized) return null;
  const digits = normalized.replace(/\D/g, '');
  return Markup.button.callback(t(lang, 'btn_call_customer'), `ord:ph:${digits}`);
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

/** web_app → ComboDetail (?combo=id). */
export function comboButtonRow(
  lang: Lang,
  comboId: string,
  webAppUrl?: string,
): InlineKeyboardButton[] | null {
  if (!webAppUrl || !webAppUrl.startsWith('https://')) return null;
  const sep = webAppUrl.includes('?') ? '&' : '?';
  const url = `${webAppUrl}${sep}combo=${encodeURIComponent(comboId)}`;
  return [Markup.button.webApp(t(lang, 'btn_webapp'), url)];
}

/** web_app → профиль / checkout registration. */
export function profileButtonRow(lang: Lang, webAppUrl?: string): InlineKeyboardButton[] | null {
  if (!webAppUrl || !webAppUrl.startsWith('https://')) return null;
  return [Markup.button.webApp(t(lang, 'btn_profile'), webAppUrl)];
}
