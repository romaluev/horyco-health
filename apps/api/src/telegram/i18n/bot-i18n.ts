import { Language, OrderStatus, Category, orderStatusLabel } from '@eatfit/shared';

/**
 * Тексты бота на двух языках (ru/uz). В хендлерах строки не хардкодим — берём только отсюда
 * (паритет с легаси src/i18n.js). Источник истины для UI бота; общий i18n nestjs-i18n для
 * API/нотификаций — отдельная задача (AR-7), здесь сознательно лёгкий бот-словарь.
 */
type Entry = { ru: string; uz: string };

const dict = {
  // ---- Регистрация / язык ----
  choose_language: { ru: 'Выберите язык / Tilni tanlang:', uz: 'Выберите язык / Tilni tanlang:' },
  language_set: { ru: 'Язык установлен: Русский 🇷🇺', uz: 'Til tanlandi: O‘zbek 🇺🇿' },
  ask_full_name: {
    ru: 'Введите имя и фамилию (например: Иван Иванов):',
    uz: 'Ism va familiyangizni kiriting (masalan: Ali Valiyev):',
  },
  ask_phone: {
    ru: 'Отправьте номер телефона кнопкой ниже или введите вручную:',
    uz: 'Telefon raqamingizni pastdagi tugma orqali yuboring yoki qo‘lda kiriting:',
  },
  share_contact: { ru: '📱 Поделиться контактом', uz: '📱 Kontaktni ulashish' },
  ask_address: { ru: 'Введите адрес доставки:', uz: 'Yetkazib berish manzilini kiriting:' },
  ask_location: {
    ru: 'Отправьте точку доставки на карте — нажмите кнопку ниже:',
    uz: 'Yetkazib berish nuqtasini xaritada yuboring — pastdagi tugmani bosing:',
  },
  share_location: { ru: '📍 Отправить локацию', uz: '📍 Lokatsiyani yuborish' },
  location_saved: {
    ru: 'Точка на карте сохранена ✅',
    uz: 'Xaritadagi nuqta saqlandi ✅',
  },
  invalid_location: {
    ru: 'Нужна геолокация. Нажмите кнопку «Отправить локацию» ниже:',
    uz: 'Geolokatsiya kerak. Pastdagi «Lokatsiyani yuborish» tugmasini bosing:',
  },
  ask_landmark: {
    ru: 'Добавьте ориентир (подъезд, квартира, этаж) или нажмите «Пропустить»:',
    uz: 'Mo‘ljal qo‘shing (kirish, kvartira, qavat) yoki «O‘tkazib yuborish»ni bosing:',
  },
  btn_skip_landmark: { ru: '➡️ Пропустить', uz: '➡️ O‘tkazib yuborish' },
  pf_location: { ru: '📍 Точка на карте', uz: '📍 Xaritadagi nuqta' },
  btn_open_maps: { ru: '📍 Открыть на карте', uz: '📍 Xaritada ochish' },
  profile_landmark: { ru: 'Ориентир', uz: 'Mo‘ljal' },
  profile_location_set: { ru: 'Точка на карте указана', uz: 'Xaritadagi nuqta ko‘rsatilgan' },
  profile_location_missing: { ru: 'Точка на карте не указана', uz: 'Xaritadagi nuqta ko‘rsatilmagan' },

  welcome_new: {
    ru: 'Добро пожаловать в {businessName}! 🎉\n\nБыстрая настройка — телефон и точка доставки.',
    uz: '{businessName} ga xush kelibsiz! 🎉\n\nTez sozlash — telefon va yetkazib berish nuqtasi.',
  },
  welcome_back: {
    ru: 'С возвращением в {businessName}! 👋',
    uz: '{businessName} ga yana xush kelibsiz! 👋',
  },
  registration_intro: {
    ru: 'Для доставки нам нужны ваш телефон и точка на карте.',
    uz: 'Yetkazib berish uchun telefon va xaritadagi nuqta kerak.',
  },
  checkout_need_profile: {
    ru: 'Сначала завершите регистрацию — отправьте /start',
    uz: 'Avval ro‘yxatdan o‘ting — /start yuboring',
  },
  first_order_congrats: {
    ru: 'Поздравляем с первым заказом! 🎉 Приятного аппетита!',
    uz: 'Birinchi buyurtmangiz bilan tabriklaymiz! 🎉 Yoqimli ishtaha!',
  },
  hint_empty_cart: {
    ru: 'Выберите блюда в меню, затем нажмите «Оформить заказ».',
    uz: 'Menyudan taom tanlang, keyin «Buyurtmani rasmiylashtirish»ni bosing.',
  },
  hint_use_menu_button: {
    ru: 'Нажмите «🍽 Сделать заказ», чтобы открыть меню.',
    uz: 'Menyuni ochish uchun «🍽 Buyurtma berish»ni bosing.',
  },
  hint_support_available: {
    ru: 'Если нужна помощь — раздел «🆘 Поддержка» в меню.',
    uz: 'Yordam kerak bo‘lsa — menyudagi «🆘 Yordam» bo‘limi.',
  },
  offer_accept_ok: { ru: 'Заказ оформлен ✅', uz: 'Buyurtma rasmiylashtirildi ✅' },
  offer_accept_need_profile: {
    ru: 'Сначала укажите профиль и точку доставки в приложении:',
    uz: 'Avval ilovada profil va yetkazish nuqtasini ko‘rsating:',
  },
  offer_accept_failed: { ru: 'Не удалось оформить заказ.', uz: 'Buyurtma rasmiylashtirib bo‘lmadi.' },
  staff_invite_wrong_account: {
    ru: 'Это приглашение предназначено другому аккаунту.',
    uz: 'Bu taklif boshqa akkaunt uchun.',
  },
  staff_invite_accepted: {
    ru: '✅ Вы приняли приглашение в команду!',
    uz: '✅ Jamoa taklifini qabul qildingiz!',
  },
  btn_my_orders_short: { ru: '📦 Мои заказы', uz: '📦 Buyurtmalarim' },
  btn_view_balance: { ru: '💰 Баланс', uz: '💰 Balans' },
  broadcast_offer_title: { ru: 'Специальное предложение', uz: 'Maxsus taklif' },
  broadcast_btn_accept: { ru: '✅ Оформить', uz: '✅ Rasmiylashtirish' },
  broadcast_btn_customize: { ru: '✏️ Изменить', uz: '✏️ O‘zgartirish' },
  bind_usage: {
    ru: 'Использование: /bind cook | courier | admin',
    uz: 'Foydalanish: /bind cook | courier | admin',
  },
  bind_success: { ru: 'Группа привязана ✅', uz: 'Guruh bog‘landi ✅' },
  bind_unknown_kind: { ru: 'Неизвестный тип группы.', uz: 'Noma’lum guruh turi.' },
  bind_groups_only: { ru: 'Привязка работает только в группах.', uz: 'Bog‘lash faqat guruhlarda ishlaydi.' },
  bind_start_first: { ru: 'Сначала напишите боту в личку /start', uz: 'Avval botga shaxsiy chatda /start yuboring' },
  bind_owner_only: {
    ru: 'Только владелец или менеджер может привязать группу.',
    uz: 'Guruhni faqat egasi yoki menejer bog‘lay oladi.',
  },
  bind_bot_added_hint: {
    ru: '👋 Бот добавлен в группу.\n\nВладелец или менеджер: выполните команду\n/bind cook, /bind courier или /bind admin',
    uz: '👋 Bot guruhga qo‘shildi.\n\nEga yoki menejer:\n/bind cook, /bind courier yoki /bind admin buyrug‘ini bajaring',
  },
  profile_link_hint: {
    ru: 'Откройте профиль в приложении, чтобы указать адрес:',
    uz: 'Manzilni ko‘rsatish uchun ilovada profilni oching:',
  },
  notify_ready: {
    ru: 'Заказ готов, скоро передадим курьеру 🍽',
    uz: 'Buyurtma tayyor, tez orada kuryerga topshiramiz 🍽',
  },
  group_order_ready: { ru: 'готов к доставке', uz: 'yetkazishga tayyor' },

  registration_done: { ru: 'Регистрация завершена! 🎉', uz: 'Ro‘yxatdan o‘tish yakunlandi! 🎉' },
  invalid_phone: {
    ru: 'Похоже, это не телефон. Попробуйте ещё раз:',
    uz: 'Bu telefon raqamiga o‘xshamaydi. Qayta urinib ko‘ring:',
  },

  // ---- Главное меню ----
  main_menu: { ru: 'Главное меню:', uz: 'Asosiy menyu:' },
  btn_make_order: { ru: '🍽 Сделать заказ', uz: '🍽 Buyurtma berish' },
  btn_profile: { ru: '👤 Мой профиль', uz: '👤 Profilim' },
  btn_balance: { ru: '💰 Мой баланс', uz: '💰 Balansim' },
  btn_my_orders: { ru: '📦 Мои заказы', uz: '📦 Buyurtmalarim' },
  btn_cook_mode: { ru: '👨‍🍳 Режим повара', uz: '👨‍🍳 Oshpaz rejimi' },
  btn_courier_mode: { ru: '🚗 Режим курьера', uz: '🚗 Kuryer rejimi' },
  btn_admin_panel: { ru: '🔧 Админ-панель', uz: '🔧 Admin panel' },
  btn_support: { ru: '🆘 Поддержка', uz: '🆘 Yordam' },
  btn_webapp: { ru: '🌐 Открыть приложение', uz: '🌐 Ilovani ochish' },

  // ---- Профиль / баланс ----
  profile_title: { ru: '👤 Ваш профиль', uz: '👤 Sizning profilingiz' },
  profile_name: { ru: 'Имя', uz: 'Ism' },
  profile_phone: { ru: 'Телефон', uz: 'Telefon' },
  profile_address: { ru: 'Адрес', uz: 'Manzil' },
  profile_balance: { ru: 'Баланс', uz: 'Balans' },
  balance_title: { ru: '💰 Ваш баланс', uz: '💰 Sizning balansingiz' },
  currency: { ru: 'сум', uz: 'so‘m' },

  // ---- Пополнение баланса (контакты) ----
  btn_topup: { ru: '💳 Пополнить баланс', uz: '💳 Balansni to‘ldirish' },
  topup_title: { ru: '💳 Пополнение баланса', uz: '💳 Balansni to‘ldirish' },
  topup_text: {
    ru: 'Чтобы пополнить баланс, напишите в Telegram или позвоните по номеру ниже:',
    uz: 'Balansni to‘ldirish uchun quyidagi Telegram’ga yozing yoki raqamga qo‘ng‘iroq qiling:',
  },
  topup_tg: { ru: 'Telegram', uz: 'Telegram' },
  topup_phone: { ru: 'Телефон', uz: 'Telefon' },
  topup_not_set: {
    ru: 'Контакты для пополнения пока не указаны. Обратитесь к администратору.',
    uz: 'To‘ldirish uchun kontaktlar hali ko‘rsatilmagan. Administratorga murojaat qiling.',
  },

  // ---- Поддержка ----
  support_title: { ru: '🆘 Поддержка', uz: '🆘 Yordam' },
  support_text: {
    ru: 'Если у вас есть вопрос или проблема — свяжитесь с нами:',
    uz: 'Savol yoki muammo bo‘lsa — biz bilan bog‘laning:',
  },
  support_contact_btn: { ru: '✍️ Написать в поддержку', uz: '✍️ Yordamga yozish' },
  support_not_set: {
    ru: 'Контакты поддержки пока не указаны. Попробуйте позже.',
    uz: 'Yordam kontaktlari hali ko‘rsatilmagan. Keyinroq urinib ko‘ring.',
  },

  // ---- Редактирование профиля ----
  btn_edit_profile: { ru: '✏️ Редактировать профиль', uz: '✏️ Profilni tahrirlash' },
  profile_choose_field: { ru: 'Что изменить?', uz: 'Nimani o‘zgartiramiz?' },
  pf_name: { ru: '👤 Имя и фамилия', uz: '👤 Ism va familiya' },
  pf_phone: { ru: '📞 Телефон', uz: '📞 Telefon' },
  pf_address: { ru: '📍 Адрес', uz: '📍 Manzil' },
  pf_language: { ru: '🌐 Язык', uz: '🌐 Til' },
  pf_password: { ru: '🔐 Пароль для сайта', uz: '🔐 Sayt uchun parol' },
  ask_password: {
    ru: 'Введите новый пароль (минимум 6 символов) — для входа на сайте по телефону:',
    uz: 'Yangi parol kiriting (kamida 6 ta belgi) — saytga telefon orqali kirish uchun:',
  },
  password_too_short: { ru: 'Пароль слишком короткий (минимум 6 символов).', uz: 'Parol juda qisqa (kamida 6 ta belgi).' },
  password_saved: {
    ru: 'Пароль сохранён ✅ Теперь можно войти на сайте по телефону и паролю.',
    uz: 'Parol saqlandi ✅ Endi saytga telefon va parol bilan kirishingiz mumkin.',
  },
  profile_ask_name: { ru: 'Введите имя и фамилию:', uz: 'Ism va familiyani kiriting:' },
  profile_ask_address: { ru: 'Введите новый адрес доставки:', uz: 'Yangi yetkazib berish manzilini kiriting:' },
  profile_saved: { ru: 'Профиль обновлён ✅', uz: 'Profil yangilandi ✅' },

  // ---- Меню / категории ----
  menu_title: { ru: '🍽 Меню', uz: '🍽 Menyu' },
  menu_empty: { ru: 'Меню пока пустое.', uz: 'Menyu hozircha bo‘sh.' },
  cat_main: { ru: '🍲 Основные блюда', uz: '🍲 Asosiy taomlar' },
  cat_drink: { ru: '🥤 Напитки', uz: '🥤 Ichimliklar' },
  cat_dessert: { ru: '🍰 Десерты', uz: '🍰 Shirinliklar' },

  // ---- Корзина / заказ ----
  btn_add_to_cart: { ru: '➕ Добавить в корзину', uz: '➕ Savatga qo‘shish' },
  btn_decline: { ru: '❌ Не надо', uz: '❌ Kerak emas' },
  added_to_cart: { ru: 'Добавлено в корзину ✅', uz: 'Savatga qo‘shildi ✅' },
  add_something_else: { ru: 'Добавить что-то ещё?', uz: 'Yana biror narsa qo‘shasizmi?' },
  btn_drinks: { ru: 'Напитки 🥤', uz: 'Ichimliklar 🥤' },
  btn_desserts: { ru: 'Десерты 🍰', uz: 'Shirinliklar 🍰' },
  btn_checkout: { ru: '✅ Оформить заказ', uz: '✅ Buyurtmani rasmiylashtirish' },
  checkout_prompt: { ru: 'Когда всё выбрали — оформите заказ:', uz: 'Hammasini tanlab bo‘lgach — buyurtma bering:' },
  cart_title: { ru: '🛒 Ваша корзина', uz: '🛒 Sizning savatingiz' },
  cart_empty: { ru: 'Корзина пуста.', uz: 'Savat bo‘sh.' },
  cart_total: { ru: 'Итого', uz: 'Jami' },
  cart_address: { ru: 'Адрес доставки', uz: 'Yetkazib berish manzili' },
  pay_from_balance_q: {
    ru: 'На балансе достаточно средств. Списать с баланса?',
    uz: 'Balansda yetarli mablag‘ bor. Balansdan yechib olaylikmi?',
  },
  btn_pay_balance: { ru: '💰 Оплатить с баланса', uz: '💰 Balansdan to‘lash' },
  btn_pay_cash: { ru: '💵 Оплатить при получении', uz: '💵 Yetkazib berishda to‘lash' },
  btn_confirm_order: { ru: '✅ Подтвердить заказ', uz: '✅ Buyurtmani tasdiqlash' },
  btn_order_now: { ru: '👉 Заказать', uz: '👉 Buyurtma berish' },
  quick_order_need_location: {
    ru: 'Для доставки нужна ваша точка на карте. Отправьте геолокацию — после этого заказ оформится автоматически:',
    uz: 'Yetkazib berish uchun xaritadagi nuqtangiz kerak. Geolokatsiyani yuboring — keyin buyurtma avtomatik rasmiylashtiriladi:',
  },
  quick_order_created: { ru: 'Заказ оформлен! Номер', uz: 'Buyurtma qabul qilindi! Raqam' },
  quick_order_combo_includes: { ru: 'В составе', uz: 'Tarkibida' },
  order_confirm_title: { ru: 'Заказ оформлен', uz: 'Buyurtma rasmiylashtirildi' },
  teaser_order_until: { ru: 'заказ до', uz: 'buyurtma gacha' },
  label_payment_balance: { ru: 'с баланса', uz: 'balansdan' },
  label_payment_cash: { ru: 'при получении', uz: 'yetkazib berishda' },
  label_payment_row: { ru: 'Оплата', uz: 'To‘lov' },
  order_age_minutes: { ru: '{n} мин назад', uz: '{n} daqiqa oldin' },
  btn_call_customer: { ru: '📞 Позвонить', uz: '📞 Qo‘ng‘iroq qilish' },
  group_header_new: { ru: '🆕 Новый заказ', uz: '🆕 Yangi buyurtma' },
  group_header_cooking: { ru: '👨‍🍳 Готовится', uz: '👨‍🍳 Tayyorlanmoqda' },
  group_header_done: { ru: '✅ Завершён', uz: '✅ Yakunlandi' },
  group_header_cancelled: { ru: '❌ Отменён', uz: '❌ Bekor qilindi' },
  group_header_courier_ready: { ru: '🚗 Готов к доставке', uz: '🚗 Yetkazishga tayyor' },
  group_header_courier_enroute: { ru: '🚗 В пути', uz: '🚗 Yo‘lda' },
  group_header_admin: { ru: '📋 Заказ', uz: '📋 Buyurtma' },
  admin_no_orders: { ru: 'Активных заказов нет.', uz: 'Faol buyurtmalar yo‘q.' },
  customer_label: { ru: 'Клиент', uz: 'Mijoz' },
  btn_cancel: { ru: '❌ Отмена', uz: '❌ Bekor qilish' },
  order_created: { ru: 'Ваш заказ оформлен! Номер заказа', uz: 'Buyurtmangiz qabul qilindi! Buyurtma raqami' },
  order_cancelled_msg: { ru: 'Оформление отменено.', uz: 'Rasmiylashtirish bekor qilindi.' },
  balance_insufficient: {
    ru: '❌ Недостаточно средств на балансе. Выберите оплату при получении.',
    uz: '❌ Balansda mablag‘ yetarli emas. Yetkazib berishda to‘lashni tanlang.',
  },
  ask_comment: {
    ru: 'Добавьте комментарий к заказу или нажмите кнопку ниже:',
    uz: 'Buyurtmaga izoh qoldiring yoki pastdagi tugmani bosing:',
  },
  btn_no_comment: { ru: '➡️ Без комментария', uz: '➡️ Izohsiz' },

  // ---- Мои заказы ----
  my_orders_title: { ru: '📦 Ваши заказы', uz: '📦 Sizning buyurtmalaringiz' },
  no_orders: { ru: 'У вас пока нет заказов.', uz: 'Sizda hozircha buyurtmalar yo‘q.' },
  order_label: { ru: 'Заказ', uz: 'Buyurtma' },
  status_label: { ru: 'Статус', uz: 'Holati' },

  // Статусы заказа — единый источник в libs/shared (orderStatusLabel), см. statusText().

  // ---- Уведомления клиенту (UI бота; push — libs/shared/order-notify-messages) ----

  // ---- Повар ----
  cook_panel_title: { ru: '👨‍🍳 Режим повара — активные заказы:', uz: '👨‍🍳 Oshpaz rejimi — faol buyurtmalar:' },
  cook_no_orders: { ru: 'Активных заказов нет.', uz: 'Faol buyurtmalar yo‘q.' },
  btn_take_to_work: { ru: '✅ Принять в работу', uz: '✅ Ishga qabul qilish' },
  btn_ready: { ru: '🍽 Готово', uz: '🍽 Tayyor' },
  taken_to_work: { ru: 'Заказ принят в работу', uz: 'Buyurtma ishga qabul qilindi' },
  marked_ready: { ru: 'Заказ помечен как готовый', uz: 'Buyurtma tayyor deb belgilandi' },

  // ---- Курьер ----
  courier_panel_title: { ru: '🚗 Режим курьера — заказы к доставке:', uz: '🚗 Kuryer rejimi — yetkazib berish buyurtmalari:' },
  courier_no_orders: { ru: 'Заказов к доставке нет.', uz: 'Yetkazib berish buyurtmalari yo‘q.' },
  btn_take_delivery: { ru: '🚗 Взять доставку', uz: '🚗 Yetkazib berishni olish' },
  btn_delivered: { ru: '✅ Доставил', uz: '✅ Yetkazib berdim' },
  delivery_taken: { ru: 'Доставка закреплена за вами', uz: 'Yetkazib berish sizga biriktirildi' },
  delivery_done: { ru: 'Заказ доставлен', uz: 'Buyurtma yetkazib berildi' },

  // ---- Группы ----
  group_new_order: { ru: '🆕 Новый заказ', uz: '🆕 Yangi buyurtma' },
  group_comment: { ru: '📝 Комментарий', uz: '📝 Izoh' },
  group_ready_delivery: { ru: 'готов к доставке', uz: 'yetkazishga tayyor' },
  group_address: { ru: '📍 Адрес', uz: '📍 Manzil' },
  group_phone: { ru: '📞 Телефон', uz: '📞 Telefon' },
  total_calories: { ru: 'Калорийность', uz: 'Kaloriya' },
  unit_kcal: { ru: 'ккал', uz: 'kkal' },
  unit_gram: { ru: 'г', uz: 'g' },

  // ---- Админ ----
  admin_panel_title: { ru: '⚙️ Панель администратора', uz: '⚙️ Administrator paneli' },
  admin_menu_mgmt: { ru: '📋 Управление меню', uz: '📋 Menyuni boshqarish' },
  admin_users: { ru: '👥 Пользователи', uz: '👥 Foydalanuvchilar' },
  admin_deposits: { ru: '💰 Депозиты', uz: '💰 Depozitlar' },
  admin_orders: { ru: '📊 Заказы', uz: '📊 Buyurtmalar' },
  admin_report: { ru: '📈 Отправить итоги', uz: '📈 Yakunlarni yuborish' },
  report_sent: { ru: 'Итоги отправлены ✅', uz: 'Yakunlar yuborildi ✅' },
  btn_cancel_order: { ru: '🚫 Отменить', uz: '🚫 Bekor qilish' },
  order_cancelled_admin: { ru: 'Заказ отменён, средства возвращены', uz: 'Buyurtma bekor qilindi, mablag‘ qaytarildi' },
  order_already_closed: { ru: 'Заказ уже завершён или отменён', uz: 'Buyurtma allaqachon yakunlangan yoki bekor qilingan' },

  // ---- Настройки (админ) ----
  admin_settings: { ru: '⚙️ Настройки', uz: '⚙️ Sozlamalar' },
  settings_title: { ru: '⚙️ Настройки', uz: '⚙️ Sozlamalar' },
  set_topup_tg: { ru: '✏️ Telegram пополнения', uz: '✏️ To‘ldirish Telegram' },
  set_topup_phone: { ru: '✏️ Телефон пополнения', uz: '✏️ To‘ldirish telefon' },
  set_support: { ru: '✏️ Кнопка «Поддержка»', uz: '✏️ «Yordam» tugmasi' },
  ask_topup_tg: {
    ru: 'Введите Telegram для пополнения (@username или ссылку https://t.me/...):',
    uz: 'To‘ldirish uchun Telegram kiriting (@username yoki https://t.me/... havola):',
  },
  ask_topup_phone: { ru: 'Введите телефон для пополнения:', uz: 'To‘ldirish uchun telefon kiriting:' },
  ask_support: {
    ru: 'Куда ведёт кнопка «Поддержка»? @username, ссылка https://t.me/... или телефон:',
    uz: '«Yordam» tugmasi qayerga yo‘naltirsin? @username, https://t.me/... havola yoki telefon:',
  },
  setting_saved: { ru: 'Сохранено ✅', uz: 'Saqlandi ✅' },
  not_set_dash: { ru: 'не указано', uz: 'ko‘rsatilmagan' },

  btn_add_dish: { ru: '➕ Добавить блюдо', uz: '➕ Taom qo‘shish' },
  btn_edit: { ru: '✏️ Редактировать', uz: '✏️ Tahrirlash' },
  btn_hide: { ru: '🙈 Скрыть', uz: '🙈 Yashirish' },
  btn_show: { ru: '👁 Показать', uz: '👁 Ko‘rsatish' },
  btn_delete: { ru: '🗑 Удалить', uz: '🗑 O‘chirish' },
  btn_back: { ru: '⬅️ Назад', uz: '⬅️ Orqaga' },

  dish_ask_name_ru: { ru: 'Название блюда (RU):', uz: 'Taom nomi (RU):' },
  dish_ask_name_uz: { ru: 'Название блюда (UZ):', uz: 'Taom nomi (UZ):' },
  dish_ask_desc_ru: { ru: 'Описание (RU):', uz: 'Tavsif (RU):' },
  dish_ask_desc_uz: { ru: 'Описание (UZ):', uz: 'Tavsif (UZ):' },
  dish_ask_category: { ru: 'Выберите категорию:', uz: 'Kategoriyani tanlang:' },
  dish_ask_price: { ru: 'Цена (только число, в сумах):', uz: 'Narxi (faqat raqam, so‘mda):' },
  dish_ask_photo: {
    ru: 'Отправьте фото блюда или напишите «-» чтобы пропустить:',
    uz: 'Taom rasmini yuboring yoki o‘tkazib yuborish uchun «-» yozing:',
  },
  dish_created: { ru: 'Блюдо создано ✅', uz: 'Taom yaratildi ✅' },
  dish_hidden: { ru: 'Блюдо скрыто', uz: 'Taom yashirildi' },
  dish_shown: { ru: 'Блюдо снова активно', uz: 'Taom yana faol' },
  dish_deleted: { ru: 'Блюдо удалено', uz: 'Taom o‘chirildi' },
  invalid_price: { ru: 'Введите корректное число:', uz: 'To‘g‘ri raqam kiriting:' },

  edit_choose_field: { ru: 'Что отредактировать?', uz: 'Nimani tahrirlash?' },
  field_name_ru: { ru: '📝 Название (RU)', uz: '📝 Nomi (RU)' },
  field_name_uz: { ru: '📝 Название (UZ)', uz: '📝 Nomi (UZ)' },
  field_desc_ru: { ru: '📄 Описание (RU)', uz: '📄 Tavsif (RU)' },
  field_desc_uz: { ru: '📄 Описание (UZ)', uz: '📄 Tavsif (UZ)' },
  field_category: { ru: '🗂 Категория', uz: '🗂 Kategoriya' },
  field_price: { ru: '💵 Цена', uz: '💵 Narx' },
  field_photo: { ru: '🖼 Фото', uz: '🖼 Rasm' },
  field_days: { ru: '📅 Дни', uz: '📅 Kunlar' },
  days_choose: { ru: 'Дни показа основного блюда (без дней — не в меню). Напитки/десерты — всегда:', uz: 'Asosiy taom kunlari (kunsiz — menyuda yo‘q). Ichimlik/shirinlik — doim:' },
  days_clear: { ru: '♻️ Сбросить', uz: '♻️ Tozalash' },
  btn_done: { ru: '✅ Готово', uz: '✅ Tayyor' },
  day_1: { ru: 'Пн', uz: 'Du' },
  day_2: { ru: 'Вт', uz: 'Se' },
  day_3: { ru: 'Ср', uz: 'Cho' },
  day_4: { ru: 'Чт', uz: 'Pa' },
  day_5: { ru: 'Пт', uz: 'Ju' },
  day_6: { ru: 'Сб', uz: 'Sha' },
  day_7: { ru: 'Вс', uz: 'Yak' },
  dish_del_confirm: { ru: 'Удалить блюдо?', uz: 'Taom o‘chirilsinmi?' },
  btn_yes: { ru: '✅ Да', uz: '✅ Ha' },
  btn_no: { ru: '↩️ Нет', uz: '↩️ Yo‘q' },
  tag_hidden: { ru: 'скрыто', uz: 'yashirilgan' },
  edit_saved: { ru: 'Изменения сохранены ✅', uz: 'O‘zgarishlar saqlandi ✅' },

  users_ask_query: {
    ru: 'Введите номер телефона или username для поиска:',
    uz: 'Qidirish uchun telefon raqami yoki username kiriting:',
  },
  user_not_found: { ru: 'Пользователь не найден.', uz: 'Foydalanuvchi topilmadi.' },
  btn_change_role: { ru: '🔁 Изменить роль', uz: '🔁 Rolni o‘zgartirish' },
  role_changed: { ru: 'Роль изменена на', uz: 'Rol o‘zgartirildi:' },

  deposit_add: { ru: '➕ Пополнить баланс', uz: '➕ Balansni to‘ldirish' },
  deposit_ask_client: { ru: 'Введите telegram_id или телефон клиента:', uz: 'Mijozning telegram_id yoki telefonini kiriting:' },
  deposit_ask_amount: { ru: 'Введите сумму пополнения:', uz: 'To‘ldirish summasini kiriting:' },
  deposit_client_found: { ru: 'Клиент', uz: 'Mijoz' },
  deposit_choose_client: { ru: 'Найдено несколько — выберите клиента:', uz: 'Bir nechta topildi — mijozni tanlang:' },
  deposit_done: { ru: 'Баланс пополнен ✅', uz: 'Balans to‘ldirildi ✅' },
  deposit_history: { ru: 'История пополнений:', uz: 'To‘ldirishlar tarixi:' },
  withdraw_add: { ru: '➖ Списать с баланса', uz: '➖ Balansdan yechish' },
  withdraw_ask_client: { ru: 'Введите telegram_id или телефон клиента для списания:', uz: 'Yechish uchun mijozning telegram_id yoki telefonini kiriting:' },
  withdraw_ask_amount: { ru: 'Введите сумму списания:', uz: 'Yechish summasini kiriting:' },
  withdraw_done: { ru: 'Списание выполнено ✅', uz: 'Yechish bajarildi ✅' },

  // ---- Посты в канал (FR-B4) ----
  admin_gen_post: { ru: '📢 Пост в канал', uz: '📢 Kanalga post' },
  gen_post_choose: { ru: 'Выберите блюдо для поста:', uz: 'Post uchun taomni tanlang:' },
  post_order_btn: { ru: '👉 Заказать', uz: '👉 Buyurtma berish' },
  btn_publish_channel: { ru: '📤 Опубликовать в канал', uz: '📤 Kanalga joylash' },
  published_ok: { ru: 'Опубликовано в канал ✅', uz: 'Kanalga joylandi ✅' },
  channel_not_set: {
    ru: '⚠️ CHANNEL_ID не задан. Укажите канал и добавьте бота его админом.',
    uz: '⚠️ CHANNEL_ID ko‘rsatilmagan. Kanalni qo‘shing va botni unga admin qiling.',
  },

  // ---- Ошибки / доступ ----
  error_generic: { ru: '⚠️ Произошла ошибка. Попробуйте позже.', uz: '⚠️ Xatolik yuz berdi. Keyinroq urinib ko‘ring.' },
  access_denied: { ru: '⛔ Недостаточно прав.', uz: '⛔ Ruxsat yetarli emas.' },
  not_registered: {
    ru: 'Пожалуйста, завершите регистрацию — отправьте /start',
    uz: 'Iltimos, ro‘yxatdan o‘ting — /start yuboring',
  },
  dish_not_found: { ru: 'Блюдо не найдено или недоступно.', uz: 'Taom topilmadi yoki mavjud emas.' },
  pcs: { ru: 'шт', uz: 'dona' },
  btn_details: { ru: '🔎 Подробнее', uz: '🔎 Batafsil' },
} satisfies Record<string, Entry>;

export type I18nKey = keyof typeof dict;
export type Lang = Language;

/** Строка по ключу на нужном языке (фолбэк ru → ключ). */
export function t(lang: Lang, key: I18nKey): string {
  const entry = dict[key];
  if (!entry) return key;
  return entry[lang === Language.Uz ? 'uz' : 'ru'] || entry.ru || key;
}

/** Локализованное название категории. */
export function categoryName(lang: Lang, category: Category): string {
  const map: Record<Category, I18nKey> = {
    [Category.Main]: 'cat_main',
    [Category.Drink]: 'cat_drink',
    [Category.Dessert]: 'cat_dessert',
  };
  return t(lang, map[category] ?? 'cat_main');
}

/** Локализованный текст статуса заказа (единый источник — libs/shared). */
export function statusText(lang: Lang, status: OrderStatus): string {
  return orderStatusLabel(lang, status);
}

/** Локализованный выбор из ru/uz пары (для названий/описаний блюд из БД). */
export function pick(lang: Lang, ru?: string | null, uz?: string | null): string {
  return (lang === Language.Uz ? uz : ru) || ru || uz || '';
}

/** Форматирование суммы: 25000 → "25 000". */
export function formatMoney(amount: number | string): string {
  const n = Math.round(Number(amount) || 0);
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** Экранирование для parse_mode: 'HTML'. */
export function esc(s: unknown): string {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
