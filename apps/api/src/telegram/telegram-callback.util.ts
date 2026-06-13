import type { Context } from 'telegraf';

export function isStaleCallbackError(err: unknown): boolean {
  const msg = (err as Error)?.message ?? '';
  return msg.includes('query is too old') || msg.includes('query ID is invalid');
}

/** answerCbQuery that ignores expired callbacks (queue backlog / Telegram retries). */
export async function safeAnswerCbQuery(ctx: Context, text?: string): Promise<void> {
  try {
    if (text) {
      await ctx.answerCbQuery(text);
    } else {
      await ctx.answerCbQuery();
    }
  } catch (err) {
    if (!isStaleCallbackError(err)) {
      throw err;
    }
  }
}
