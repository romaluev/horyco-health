import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectBot } from 'nestjs-telegraf';
import { Telegraf } from 'telegraf';

/**
 * Меню команд Telegram (setMyCommands) со скоупами:
 *  - обычные пользователи (all_private_chats) видят только клиентские команды;
 *  - админы (по ADMIN_TELEGRAM_IDS) дополнительно видят /admin и /report.
 * Так /admin не отображается обычным пользователям (а @Command('admin') ещё и закрыт гвардом).
 */
@Injectable()
export class BotCommandsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(BotCommandsService.name);

  constructor(
    @InjectBot() private readonly bot: Telegraf,
    private readonly config: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (this.config.get<boolean>('bot.enabled') === false) return;

    // Глобальный перехватчик ошибок хендлеров: без него исключение из @Action/@On
    // (напр. NotFoundError при повторном тапе) уходит в дефолт Telegraf — кнопка
    // остаётся «вечно в загрузке», а пользователь не видит реакции. Логируем и гасим спиннер.
    this.bot.catch((err, ctx) => {
      this.logger.error(`Ошибка хендлера бота: ${(err as Error).message}`, (err as Error).stack);
      void ctx.answerCbQuery().catch(() => undefined);
    });

    // Запуск long polling. НЕ await — launch() резолвится только при остановке бота.
    // .catch обязателен: иначе reject (409 «terminated by other getUpdates», неверный токен,
    // сеть) станет unhandledRejection и уронит весь процесс (Node ≥15) → API недоступен.
    void this.bot
      .launch()
      .catch((err) => this.logger.error(`Бот не запущен (API работает дальше): ${(err as Error).message}`));

    const base = [
      { command: 'start', description: 'Главное меню' },
      { command: 'menu', description: 'Меню ресторана' },
      { command: 'profile', description: 'Мой профиль' },
    ];
    const adminExtra = [
      { command: 'admin', description: 'Админ-панель' },
      { command: 'report', description: 'Итоги дня' },
    ];

    // Дефолт для всех (без /admin) — главное: скрыть админ-команды от обычных пользователей.
    try {
      await this.bot.telegram.setMyCommands(base, { scope: { type: 'all_private_chats' } });
    } catch (err) {
      this.logger.warn(`Меню команд (дефолт): ${(err as Error).message}`);
    }

    // Персональное меню админам — best-effort: «chat not found» нормально, если админ
    // ещё не открывал диалог с ботом (применится при следующем рестарте после контакта).
    const adminIds = this.config.get<string[]>('telegram.adminIds') ?? [];
    let applied = 0;
    for (const id of adminIds) {
      try {
        await this.bot.telegram.setMyCommands([...base, ...adminExtra], {
          scope: { type: 'chat', chat_id: Number(id) },
        });
        applied++;
      } catch {
        /* chat not found — админ ещё не писал боту; ок */
      }
    }
    this.logger.log(`Меню команд установлено (админам персонально: ${applied}/${adminIds.length})`);
  }
}
