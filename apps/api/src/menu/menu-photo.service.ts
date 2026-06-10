import { Readable } from 'stream';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MenuItem } from './entities/menu-item.entity';

export type PhotoResult =
  | { kind: 'stream'; stream: Readable; contentType: string }
  | { kind: 'redirect'; url: string };

/**
 * Резолв фото блюда (архитектура §SSRF-hardening):
 *  - file_id → Telegram getFile → проксируем с фиксированного api.telegram.org (нет SSRF);
 *  - внешний URL → 302 redirect, сервер сам запрос НЕ делает (нет SSRF);
 *  - нет фото → null.
 * Токен бота наружу не утекает (резолвится на сервере).
 */
@Injectable()
export class MenuPhotoService {
  private readonly logger = new Logger(MenuPhotoService.name);

  constructor(private readonly config: ConfigService) {}

  async resolve(item: MenuItem): Promise<PhotoResult | null> {
    if (item.photoFileId) {
      return this.resolveTelegramFile(item.photoFileId);
    }
    if (item.photoUrl) {
      return { kind: 'redirect', url: item.photoUrl };
    }
    return null;
  }

  private async resolveTelegramFile(fileId: string): Promise<PhotoResult | null> {
    const token = this.config.get<string>('bot.token')!;
    const metaResp = await fetch(
      `https://api.telegram.org/bot${token}/getFile?file_id=${encodeURIComponent(fileId)}`,
    );
    if (!metaResp.ok) return null;
    const meta = (await metaResp.json()) as { ok: boolean; result?: { file_path?: string } };
    const filePath = meta.ok ? meta.result?.file_path : undefined;
    if (!filePath) return null;

    const fileResp = await fetch(`https://api.telegram.org/file/bot${token}/${filePath}`);
    if (!fileResp.ok || !fileResp.body) return null;

    return {
      kind: 'stream',
      stream: Readable.fromWeb(fileResp.body as Parameters<typeof Readable.fromWeb>[0]),
      contentType: fileResp.headers.get('content-type') ?? 'image/jpeg',
    };
  }
}
