import { normalizeLocale, type UiLocale } from '@dita/core';

/** UI locale negotiated for one API request. */
export type ApiLocale = UiLocale;

interface RequestLike {
  headers: Record<string, string | string[] | undefined>;
}

const DEFAULT_API_LOCALE: ApiLocale = 'zh-CN';

function firstHeaderValue(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined;
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return undefined;
  return raw.split(',')[0]?.trim() || undefined;
}

/**
 * Request locale resolution order (Phase 8):
 * `x-dita-locale` → `Accept-Language` → `zh-CN`.
 *
 * The explicit header is what `apps/web` always sends, so a viewer with an
 * English UI still gets English lock/publish/AI diagnostics even if the
 * browser itself is set to another language.
 */
export function resolveRequestLocale(req: RequestLike): ApiLocale {
  const explicit = firstHeaderValue(req.headers['x-dita-locale']);
  if (explicit) return normalizeLocale(explicit);

  const acceptLanguage = firstHeaderValue(req.headers['accept-language']);
  if (acceptLanguage) return normalizeLocale(acceptLanguage);

  return DEFAULT_API_LOCALE;
}

export { DEFAULT_API_LOCALE };
