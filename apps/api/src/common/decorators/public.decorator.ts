import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Помечает ручку как публичную (в обход JwtAuthGuard). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
