import { Language, OrderStatus, orderStatusLabel } from '@eatfit/shared';
import { useAuthStore } from '@/store/auth.store';

/** Лёгкий i18n фронта (RU/UZ). Язык — из профиля клиента (фолбэк ru). */
type Entry = { ru: string; uz: string };

const dict = {
  loading: { ru: 'Загрузка…', uz: 'Yuklanmoqda…' },
  open_in_telegram: { ru: 'Откройте приложение в Telegram', uz: 'Ilovani Telegram’da oching' },
  error_generic: { ru: 'Что-то пошло не так', uz: 'Nimadir xato ketdi' },
  retry: { ru: 'Повторить', uz: 'Qayta urinish' },

  // навигация
  nav_menu: { ru: 'Меню', uz: 'Menyu' },
  nav_cart: { ru: 'Корзина', uz: 'Savat' },
  nav_orders: { ru: 'Заказы', uz: 'Buyurtmalar' },
  nav_profile: { ru: 'Профиль', uz: 'Profil' },
  nav_admin: { ru: 'Админ', uz: 'Admin' },

  // меню/корзина
  menu_empty: { ru: 'Меню пока пустое', uz: 'Menyu hozircha bo‘sh' },
  search_ph: { ru: 'Поиск…', uz: 'Qidirish…' },
  nothing_found: { ru: 'Ничего не найдено', uz: 'Hech narsa topilmadi' },
  cat_main: { ru: 'Основные блюда', uz: 'Asosiy taomlar' },
  cat_drink: { ru: 'Напитки', uz: 'Ichimliklar' },
  cat_dessert: { ru: 'Десерты', uz: 'Shirinliklar' },
  add: { ru: 'Добавить', uz: 'Qo‘shish' },
  cart_empty: { ru: 'Корзина пуста', uz: 'Savat bo‘sh' },
  total: { ru: 'Итого', uz: 'Jami' },
  total_calories: { ru: 'Калорийность', uz: 'Kaloriya' },
  checkout: { ru: 'Оформить заказ', uz: 'Buyurtma berish' },
  currency: { ru: 'сум', uz: 'so‘m' },

  // оформление
  comment: { ru: 'Комментарий', uz: 'Izoh' },
  comment_ph: { ru: 'Комментарий к заказу (необязательно)', uz: 'Buyurtmaga izoh (ixtiyoriy)' },
  pay_balance: { ru: 'С баланса', uz: 'Balansdan' },
  pay_cash: { ru: 'При получении', uz: 'Yetkazganda' },
  order_placed: { ru: 'Заказ оформлен!', uz: 'Buyurtma qabul qilindi!' },
  insufficient: { ru: 'Недостаточно средств на балансе', uz: 'Balansda mablag‘ yetarli emas' },

  // заказы/статусы (тексты самих статусов — единый источник в libs/shared, см. useStatusText)
  no_orders: { ru: 'У вас пока нет заказов', uz: 'Sizda hozircha buyurtmalar yo‘q' },
  order: { ru: 'Заказ', uz: 'Buyurtma' },
  status: { ru: 'Статус', uz: 'Holat' },

  // профиль/регистрация
  profile: { ru: 'Профиль', uz: 'Profil' },
  name: { ru: 'Имя', uz: 'Ism' },
  phone: { ru: 'Телефон', uz: 'Telefon' },
  address: { ru: 'Адрес', uz: 'Manzil' },
  balance: { ru: 'Баланс', uz: 'Balans' },
  language: { ru: 'Язык', uz: 'Til' },
  save: { ru: 'Сохранить', uz: 'Saqlash' },
  saved: { ru: 'Сохранено', uz: 'Saqlandi' },
  register_title: { ru: 'Регистрация', uz: 'Ro‘yxatdan o‘tish' },
  register_hint: { ru: 'Заполните профиль, чтобы заказывать', uz: 'Buyurtma berish uchun profilni to‘ldiring' },
  required: { ru: 'Обязательное поле', uz: 'Majburiy maydon' },

  // ── вход/регистрация на сайте (вне Telegram) ──
  web_welcome: { ru: 'Eat&fit — доставка еды', uz: 'Eat&fit — taom yetkazib berish' },
  web_login: { ru: 'Вход', uz: 'Kirish' },
  web_register: { ru: 'Регистрация', uz: 'Ro‘yxatdan o‘tish' },
  web_password: { ru: 'Пароль', uz: 'Parol' },
  web_password_hint: { ru: 'Минимум 6 символов', uz: 'Kamida 6 ta belgi' },
  web_to_register: { ru: 'Нет аккаунта? Зарегистрироваться', uz: 'Hisob yo‘qmi? Ro‘yxatdan o‘tish' },
  web_to_login: { ru: 'Уже есть аккаунт? Войти', uz: 'Hisob bormi? Kirish' },
  web_auth_failed: { ru: 'Неверный телефон или пароль', uz: 'Telefon yoki parol noto‘g‘ri' },
  web_register_failed: { ru: 'Не удалось зарегистрироваться (телефон может быть занят)', uz: 'Ro‘yxatdan o‘tib bo‘lmadi (telefon band bo‘lishi mumkin)' },
  logout: { ru: 'Выйти', uz: 'Chiqish' },

  // ── админка ──
  adm_orders: { ru: 'Заказы', uz: 'Buyurtmalar' },
  adm_menu: { ru: 'Меню', uz: 'Menyu' },
  adm_users: { ru: 'Люди', uz: 'Odamlar' },
  adm_settings: { ru: 'Настройки', uz: 'Sozlamalar' },
  adm_search_user: { ru: 'Телефон / username / id', uz: 'Telefon / username / id' },
  adm_role: { ru: 'Роль', uz: 'Rol' },
  adm_deposit: { ru: 'Пополнить', uz: 'To‘ldirish' },
  adm_withdraw: { ru: 'Списать', uz: 'Yechish' },
  adm_amount: { ru: 'Сумма', uz: 'Summa' },
  adm_deposit_done: { ru: 'Баланс пополнен', uz: 'Balans to‘ldirildi' },
  adm_role_changed: { ru: 'Роль изменена', uz: 'Rol o‘zgartirildi' },
  adm_add_dish: { ru: '➕ Добавить блюдо', uz: '➕ Taom qo‘shish' },
  adm_edit: { ru: 'Изменить', uz: 'Tahrirlash' },
  adm_delete: { ru: 'Удалить', uz: 'O‘chirish' },
  adm_delete_q: { ru: 'Удалить блюдо?', uz: 'Taom o‘chirilsinmi?' },
  adm_hide: { ru: 'Скрыть', uz: 'Yashirish' },
  adm_show: { ru: 'Показать', uz: 'Ko‘rsatish' },
  adm_hidden: { ru: 'скрыто', uz: 'yashirilgan' },
  adm_name_ru: { ru: 'Название (RU)', uz: 'Nomi (RU)' },
  adm_name_uz: { ru: 'Название (UZ)', uz: 'Nomi (UZ)' },
  adm_desc_ru: { ru: 'Описание (RU)', uz: 'Tavsif (RU)' },
  adm_desc_uz: { ru: 'Описание (UZ)', uz: 'Tavsif (UZ)' },
  adm_category: { ru: 'Категория', uz: 'Kategoriya' },
  adm_price: { ru: 'Цена', uz: 'Narx' },
  adm_photo_url: { ru: 'URL фото (необязательно)', uz: 'Rasm URL (ixtiyoriy)' },
  adm_days: { ru: 'Дни показа основного блюда (без дней — не в меню; напитки/десерты — всегда)', uz: 'Asosiy taom kunlari (kunsiz — menyuda yo‘q; ichimlik/shirinlik — doim)' },
  day_1: { ru: 'Пн', uz: 'Du' },
  day_2: { ru: 'Вт', uz: 'Se' },
  day_3: { ru: 'Ср', uz: 'Cho' },
  day_4: { ru: 'Чт', uz: 'Pa' },
  day_5: { ru: 'Пт', uz: 'Ju' },
  day_6: { ru: 'Сб', uz: 'Sha' },
  day_7: { ru: 'Вс', uz: 'Yak' },
  adm_photo: { ru: 'Фото блюда', uz: 'Taom rasmi' },
  adm_photo_upload: { ru: '📷 Загрузить фото', uz: '📷 Rasm yuklash' },
  adm_photo_uploading: { ru: 'Загрузка фото…', uz: 'Rasm yuklanmoqda…' },
  adm_photo_remove: { ru: 'Удалить фото', uz: 'Rasmni o‘chirish' },
  adm_photo_save_first: { ru: 'Сначала сохраните блюдо, потом добавьте фото', uz: 'Avval taomni saqlang, keyin rasm qo‘shing' },
  adm_photo_error: { ru: 'Не удалось загрузить фото: ', uz: 'Rasmni yuklab bo‘lmadi: ' },
  adm_copy_link: { ru: '🔗 Ссылка', uz: '🔗 Havola' },
  adm_link_copied: { ru: 'Ссылка скопирована', uz: 'Havola nusxalandi' },
  adm_post_preview: { ru: '👁 Пост', uz: '👁 Post' },
  adm_order_btn: { ru: '🛒 Заказать', uz: '🛒 Buyurtma' },
  adm_no_bot_username: { ru: 'BOT_USERNAME не задан — ссылка недоступна', uz: 'BOT_USERNAME yo‘q — havola mavjud emas' },
  adm_publish: { ru: '📢 Опубликовать в канал', uz: '📢 Kanalga e’lon qilish' },
  adm_publishing: { ru: 'Публикация…', uz: 'E’lon qilinmoqda…' },
  adm_published: { ru: 'Опубликовано в канал', uz: 'Kanalga e’lon qilindi' },
  act_confirm: { ru: 'Принять', uz: 'Qabul' },
  act_cook: { ru: 'Готовить', uz: 'Tayyorlash' },
  act_ready: { ru: 'Готово', uz: 'Tayyor' },
  act_deliver: { ru: 'На доставку', uz: 'Yetkazishga' },
  act_done: { ru: 'Доставлен', uz: 'Yetkazildi' },
  act_cancel: { ru: 'Отменить', uz: 'Bekor' },
  set_topup_tg: { ru: 'Telegram пополнения', uz: 'To‘ldirish Telegram' },
  set_topup_phone: { ru: 'Телефон пополнения', uz: 'To‘ldirish telefon' },
  set_support: { ru: 'Кнопка «Поддержка»', uz: '«Yordam» tugmasi' },
  role_client: { ru: 'клиент', uz: 'mijoz' },
  role_cook: { ru: 'повар', uz: 'oshpaz' },
  role_courier: { ru: 'курьер', uz: 'kuryer' },
  role_admin: { ru: 'админ', uz: 'admin' },

  // ── детальная карточка блюда ──
  detail_open: { ru: 'Подробнее', uz: 'Batafsil' },
  detail_back: { ru: 'Меню', uz: 'Menyu' },
  detail_photo_soon: { ru: '📸 Фото скоро', uz: '📸 Rasm tez orada' },
  detail_deadline: { ru: 'Заказ до', uz: 'Buyurtma' },
  detail_deadline_suffix: { ru: '', uz: 'gacha' },
  detail_composition: { ru: '📋 Состав и граммовка', uz: '📋 Tarkibi va grammlari' },
  detail_allergens: { ru: '⚠️ Аллергены', uz: '⚠️ Allergenlar' },
  detail_nutrition: { ru: '📊 Пищевая ценность', uz: '📊 Oziq-ovqat qiymati' },
  detail_contains: { ru: 'Содержит', uz: 'Tarkibida' },
  detail_may_contain: { ru: 'Может содержать', uz: 'Bo‘lishi mumkin' },
  detail_ingredient: { ru: 'Ингредиент', uz: 'Ingredient' },
  detail_portion: { ru: 'Порция', uz: 'Porsiya' },
  nut_calories: { ru: 'Энергия', uz: 'Energiya' },
  nut_protein: { ru: 'Белки', uz: 'Oqsillar' },
  nut_fat: { ru: 'Жиры', uz: 'Yog‘lar' },
  nut_carbs: { ru: 'Углеводы', uz: 'Uglevodlar' },
  unit_gram: { ru: 'г', uz: 'g' },
  unit_kcal: { ru: 'ккал', uz: 'kkal' },
  portion: { ru: 'Порция', uz: 'Porsiya' },
  portion_choose: { ru: 'Выберите порцию', uz: 'Porsiyani tanlang' },

  // ── админ: подробные поля блюда ──
  adm_weight: { ru: 'Вес, г', uz: 'Og‘irligi, g' },
  adm_price2: { ru: 'Цена 2-й порции (пусто = нет)', uz: '2-porsiya narxi (bo‘sh = yo‘q)' },
  adm_weight2: { ru: 'Вес 2-й порции, г', uz: '2-porsiya og‘irligi, g' },
  adm_deadline: { ru: 'Заказ до (ЧЧ:ММ)', uz: 'Buyurtma ...gacha (SS:DD)' },
  adm_ingredients: { ru: 'Состав (ингредиент + граммы)', uz: 'Tarkibi (ingredient + gramm)' },
  adm_ing_name_ru: { ru: 'Ингредиент (RU)', uz: 'Ingredient (RU)' },
  adm_ing_name_uz: { ru: 'Ингредиент (UZ)', uz: 'Ingredient (UZ)' },
  adm_ing_grams: { ru: 'г', uz: 'g' },
  adm_add_ingredient: { ru: '➕ Добавить ингредиент', uz: '➕ Ingredient qo‘shish' },
  adm_remove_row: { ru: '✕', uz: '✕' },
  adm_allergens: { ru: 'Аллергены', uz: 'Allergenlar' },
  adm_contains_ru: { ru: 'Содержит (RU)', uz: 'Tarkibida (RU)' },
  adm_contains_uz: { ru: 'Содержит (UZ)', uz: 'Tarkibida (UZ)' },
  adm_may_contain_ru: { ru: 'Может содержать (RU)', uz: 'Bo‘lishi mumkin (RU)' },
  adm_may_contain_uz: { ru: 'Может содержать (UZ)', uz: 'Bo‘lishi mumkin (UZ)' },
  adm_nutrition: { ru: 'Пищевая ценность (1-я порция)', uz: 'Oziq-ovqat qiymati (1-porsiya)' },
  adm_nutrition2: { ru: 'Пищевая ценность (2-я порция)', uz: 'Oziq-ovqat qiymati (2-porsiya)' },
  adm_calories: { ru: 'Ккал', uz: 'Kkal' },
  adm_protein: { ru: 'Белки, г', uz: 'Oqsil, g' },
  adm_fat: { ru: 'Жиры, г', uz: 'Yog‘, g' },
  adm_carbs: { ru: 'Углеводы, г', uz: 'Uglevod, g' },
} satisfies Record<string, Entry>;

export type I18nKey = keyof typeof dict;

export function translate(lang: Language, key: I18nKey): string {
  const e = dict[key];
  return e ? (lang === Language.Uz ? e.uz : e.ru) : key;
}

/** Хук перевода: язык берётся из текущего клиента. */
export function useT(): (key: I18nKey) => string {
  const lang = useAuthStore((s) => s.client?.language ?? Language.Ru);
  return (key: I18nKey) => translate(lang, key);
}

/** Хук локализации статуса заказа (единый источник — libs/shared/orderStatusLabel). */
export function useStatusText(): (status: OrderStatus) => string {
  const lang = useAuthStore((s) => s.client?.language ?? Language.Ru);
  return (status: OrderStatus) => orderStatusLabel(lang, status);
}
