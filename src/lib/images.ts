/**
 * Зображення сайту лежать у базі як оригінали (герой — 3283×2191, ~2,4 МБ)
 * і віддаються роутом /api/images/... Параметр `w` просить у сервера
 * зменшений варіант; для зовнішніх URL (Unsplash) нічого не змінюємо.
 */
const isInternal = (src?: string) => Boolean(src && src.startsWith('/api/images/'));

export const resizedImage = (src?: string, width?: number): string => {
  if (!src) return '';
  if (!isInternal(src) || !width) return src;
  const separator = src.includes('?') ? '&' : '?';
  return `${src}${separator}w=${width}`;
};

export const imageSrcSet = (src: string | undefined, widths: number[]): string | undefined => {
  if (!isInternal(src)) return undefined;
  return widths.map(width => `${resizedImage(src, width)} ${width}w`).join(', ');
};
