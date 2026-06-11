/**
 * Определить настройку SSL для pg:
 * локальная БД, внутренний хост Railway/Coolify — без SSL, публичный — с SSL.
 * Используется и приложением (database.module), и CLI TypeORM (data-source).
 */
export function resolveSsl(
  url?: string,
  setting?: string,
): false | { rejectUnauthorized: boolean } {
  if (setting === 'false') return false;
  if (setting === 'true') return { rejectUnauthorized: false };
  if (!url) return false;
  if (
    url.includes('localhost') ||
    url.includes('127.0.0.1') ||
    url.includes('.railway.internal') ||
    // Coolify internal Postgres (Docker service hostname, no public TLD)
    /@[a-z0-9-]+:\d+\//.test(url)
  ) {
    return false;
  }
  return { rejectUnauthorized: false };
}
