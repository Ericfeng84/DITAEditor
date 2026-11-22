import type { FastifyInstance } from 'fastify';
import type { IdentityService } from './identity-service.js';
import { resolveRequestLocale } from '../../i18n/locale.js';
import { apiT } from '../../i18n/messages.js';

export function registerIdentityRoutes(app: FastifyInstance, identity: IdentityService): void {
  app.get('/api/identity', async (req) => {
    const currentUser = identity.resolve(req.headers['x-dita-user-id']);
    const locale = resolveRequestLocale(req);
    return {
      users: identity.list(),
      currentUser,
      roles: [
        {
          id: 'admin',
          label: apiT(locale, 'identity.role.admin.label'),
          description: apiT(locale, 'identity.role.admin.description'),
        },
        {
          id: 'writer',
          label: apiT(locale, 'identity.role.writer.label'),
          description: apiT(locale, 'identity.role.writer.description'),
        },
        {
          id: 'viewer',
          label: apiT(locale, 'identity.role.viewer.label'),
          description: apiT(locale, 'identity.role.viewer.description'),
        },
      ],
    };
  });
}
