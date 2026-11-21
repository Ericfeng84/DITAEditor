import type { FastifyInstance } from 'fastify';
import type { IdentityService } from './identity-service.js';

export function registerIdentityRoutes(app: FastifyInstance, identity: IdentityService): void {
  app.get('/api/identity', async (req) => {
    const currentUser = identity.resolve(req.headers['x-dita-user-id']);
    return {
      users: identity.list(),
      currentUser,
      roles: [
        { id: 'admin', label: '管理员', description: '全部权限，可强制解锁与初始化仓库' },
        { id: 'writer', label: '作者', description: '检出文件、编辑并提交到本地 Git' },
        { id: 'viewer', label: '审阅者', description: '只读浏览、查看历史与 Diff' },
      ],
    };
  });
}
