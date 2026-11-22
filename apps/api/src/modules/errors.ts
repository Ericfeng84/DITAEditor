import type { UiLocale } from '@dita/core';
import { apiT, type ApiMessageKey, type ApiMessageParams } from '../i18n/messages.js';

export interface HttpErrorI18n {
  readonly key: ApiMessageKey;
  readonly params?: ApiMessageParams;
}

/** Small HTTP error helper shared by Phase 4 services and routes. */
export class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
    readonly details?: Record<string, unknown>,
    readonly i18n?: HttpErrorI18n,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export function isHttpError(error: unknown): error is HttpError {
  return error instanceof HttpError;
}

/**
 * Build a localizable HTTP error: `message` keeps the Chinese default for
 * logs and older callers, while `i18n.key` lets routes answer in the request
 * locale (Phase 8).
 */
export function httpError(
  statusCode: number,
  key: ApiMessageKey,
  params?: ApiMessageParams,
  details?: Record<string, unknown>,
): HttpError {
  return new HttpError(statusCode, apiT('zh-CN', key, params), details, { key, params });
}

/** Localized text for any HttpError / Error thrown inside a route handler. */
export function localizeErrorMessage(error: unknown, locale: UiLocale): string {
  if (isHttpError(error) && error.i18n) {
    return apiT(locale, error.i18n.key, error.i18n.params);
  }
  return error instanceof Error ? error.message : String(error);
}
