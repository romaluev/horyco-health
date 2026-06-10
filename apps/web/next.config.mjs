/**
 * SPA-режим (AR-11/NFR-13): статический экспорт (output:export), без SSR/серверных компонентов.
 * Готовый out/ отдаёт Nest (ServeStaticModule). Картинки не оптимизируются (нет сервера Next).
 */
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  transpilePackages: ['@eatfit/shared'],
};

export default nextConfig;
