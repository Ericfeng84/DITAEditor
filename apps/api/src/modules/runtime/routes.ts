/**
 * Runtime environment surface (`GET /api/runtime/environment`).
 *
 * Read-only and identity-free on purpose: the desktop settings panel and diagnostics must be
 * able to inspect plugin/tool readiness under any role — consistent with
 * `GET /api/publish/runtime`, which also skips the manual/identity scope.
 */

import type { FastifyInstance } from 'fastify';
import { resolveRequestLocale } from '../../i18n/locale.js';
import { localizeErrorMessage } from '../errors.js';
import {
  detectRuntimeEnvironment,
  type RuntimeEnvironmentDeps,
  type RuntimeEnvironmentReport,
} from './environment-service.js';

export type RuntimeEnvironmentRouteOptions = RuntimeEnvironmentDeps;

/**
 * `?force=0` / `?force=false` reuses the 30 s DITA-OT detection cache; anything else —
 * including a missing parameter — re-probes, so opening Desktop Settings or clicking
 * "Re-detect" always reflects a tool that was just installed.
 */
function readForceFlag(raw: unknown): boolean {
  const value = Array.isArray(raw) ? raw[raw.length - 1] : raw;
  if (typeof value !== 'string') return true;
  return !['0', 'false', 'no', 'off'].includes(value.trim().toLowerCase());
}

export function registerRuntimeEnvironmentRoutes(
  app: FastifyInstance,
  deps: RuntimeEnvironmentRouteOptions,
): void {
  app.get('/api/runtime/environment', async (req, reply): Promise<RuntimeEnvironmentReport | undefined> => {
    const locale = resolveRequestLocale(req);
    const query = (req.query ?? {}) as Record<string, unknown>;
    try {
      const report = await detectRuntimeEnvironment(deps, {
        force: readForceFlag(query['force']),
        locale,
      });
      // Availability changes as soon as the user installs a tool; never let a proxy cache it.
      reply.header('cache-control', 'no-store');
      reply.header('vary', 'x-dita-locale');
      return report;
    } catch (error) {
      // Detection is best-effort per probe; only a hard service failure (e.g. DB) lands here.
      await reply.status(500).send({ error: localizeErrorMessage(error, locale) });
      return undefined;
    }
  });
}
