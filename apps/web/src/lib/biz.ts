/** Slug бизнеса из ?biz= в URL Mini App. */
export function getBizSlug(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  const slug = new URLSearchParams(window.location.search).get('biz')?.trim();
  return slug || undefined;
}
