# 版本管理与并发协作模型（现状说明）

> 本文档描述 **DITAEditor 现行已实现**（Phase 13 落地后）的版本管理与并发协作模型：**Git 干净基线 + 个人草稿叠加层（Baseline + Draft Overlay）**、分支与 worktree 隔离、文件级独占锁、签入/取消/移交、无污染合并、安全回滚、Tag 与发布溯源、版本审计，以及剩余边界说明。
>
> - 总体架构与路线图见 [architecture-and-plan.md](../architecture-and-plan.md)
> - 关键架构决策见 [ADR 0001](../adr/0001-manual-as-independent-workspace.md)、[ADR 0002](../adr/0002-per-request-manual-isolation.md)、[ADR 0003](../adr/0003-soft-assignments-in-sqlite.md)、[ADR 0004](../adr/0004-baseline-and-draft-overlay.md)
> - Phase 13 历史实施蓝图见 [phase13-versioning-overlay.md](../plans/phase13-versioning-overlay.md)
> - 代码基准：`apps/api/src/modules/{git,locks,files,indexer,manuals,publish,validate,ai}/`、`packages/dita-core/src/semantics/semantic-engine.ts`、`apps/web/src/store/{git-store.ts,editor-store/}`

---

## 1. 核心对象模型与三层视图

### 1.1 四层对象模型

```text
Manual  (1 个独立 Git 仓库，持久化独立 UUID，解耦物理目录)
  ├── Branch  (1 个活跃分支 = 1 个物理目录：主分支 = 项目根 / 其它分支 = git worktree)
  │     ├── Shared Baseline (公共基线：workDir 永远保持 clean = HEAD + 共享基线语义索引)
  │     └── User Overlay    (个人叠加层：file_locks + working_drafts + 仓库外草稿二进制资产)
  │           └── 仅持锁人本人可见；签入时原子落盘并 git commit 推进 Baseline
  └── Baseline Tag  (不可变发布基线标签：绑定确定 Commit SHA，用于纯净发布与复现)
```

一句话概括：**共享 `workDir` 永远干净等于 `HEAD`；检出 = 加独占锁；保存/新建/删除/重命名 = 写个人草稿叠加层；签入 = 原子落盘 + `git commit` + 释锁 + 推进基线。**

### 1.2 三层读视图定义

| 视图 | 数据来源 | 可见范围 | 何时变化 |
| :--- | :--- | :--- | :--- |
| **1. 公共基线（`Baseline`）** | 分支 `workDir`（始终等于 Git `HEAD`）与共享只读 `DitaSemanticIndex` | 同分支全员共享、只读 | 仅在 **签入（Check-in）**、**合并（Merge）**、**直提恢复（Restore commit）**、**撤销提交（Revert）** 时原子推进 |
| **2. 个人叠加视图（`User Overlay`）** | `Baseline` + **仅当前用户自己**的 `working_drafts`（`edit` / `create` / `delete` / `rename`）与草稿图片资产 | 仅当前登录用户可见，完全屏蔽同分支他人未检入草稿 | 用户保存、新建、删除、重命名、上传草稿图片、取消检出或恢复草稿时 |
| **3. 编辑器瞬时内容（`Editor Live XML`）** | 浏览器当前 Tab 内存中的最新 XML 字符串 | 仅当前浏览器标签页 | 每次编辑事务（ProseMirror / CodeMirror） |

### 1.3 五条工程不变量

1. **共享 `workDir` 永远干净**：普通保存、新建、删除、重命名均写 SQLite `working_drafts`（与仓库外草稿二进制目录），不修改共享 `workDir`。同分支多人同时编辑同一 Map 下的不同 Topic 仅需 1 个 worktree 且完全零互相污染。
2. **只读请求零写副作用**：`ensureWorktree(..., { createIfMissing: false })` 保证所有 `GET` 请求绝不隐式创建分支或 worktree，也不修改进程级默认分支。
3. **单文件独占锁 + 签入原子回滚**：签入在 `withWorkDirLock(workDir)` 内原子落盘并提交；任何 Git 异常立即将 `workDir` 还原至 `HEAD`，个人草稿与锁完好无损。
4. **发布可溯源、可复现**：正式发布默认基于干净基线（`HEAD` / `Tag` / `Commit`，经 `git archive` 快照），在 `publish_jobs` 落库 `source_mode`、`source_ref`、`commit_hash`、`is_dirty` 与 `dirty_files_json`。
5. **零 XML / Git 污染**：草稿、锁、审计日志、保护分支策略全部存 SQLite；草稿二进制图片位于仓库外；手册解耦 ID 存于 `.git/ditaeditor-id`（不出现在工作区与 Git Diff 中）。

---

## 2. 仓库身份、分支与请求隔离

### 2.1 仓库身份与初始化

| 项 | 实现 |
| :--- | :--- |
| 持久化手册 ID | 新建手册生成独立 UUID 并写入 `.git/ditaeditor-id`；目录迁移后重新关联可自动认回原 `manualId`（旧手册向后兼容并懒回填） |
| 初始化 | `git init -b main`（失败时回落 `git init` + `git symbolic-ref HEAD refs/heads/main`） |
| `.gitignore` | 缺失时自动写入常见构建/临时忽略规则 |
| 提交作者 | 仓库默认身份为 `DITAEditor <dita-editor@local>`；**所有正式提交均通过 `-c` 与 `--author` 写入真实操作用户**，并加 `--no-gpg-sign --no-verify` |
| 远程 | 完全本地 Git，无 `remote` / `push` / `pull` / `fetch` |

遵循 [ADR 0001](../adr/0001-manual-as-independent-workspace.md)，一手册对应一个独立 Git 仓库，跨手册的分支、锁空间与发布历史天然隔离。

### 2.2 分支与 worktree 管理

- **目录布局**：`<worktreesRootDir>/<manual 目录名>-<sha1_16>/<slug>-<sha1(branch)_8>`（8 位分支哈希消除 `release/2.0` 与 `release__2.0` 的目录碰撞）
  - 服务端默认：`<importsRootDir>/git-worktrees`
  - 桌面端：`<userData>/git-worktrees`
- **分支名校验**：`/^[A-Za-z0-9][A-Za-z0-9._/-]{0,120}$/`，拒绝 `..`、结尾 `/`、结尾 `.lock`、开头 `-`（`400 git.invalidBranch`）。
- **并发单飞与互斥**：worktree 创建与 session 初始化使用 `inflightWorktrees` / `inflightSessions` 单飞锁；推进 `Baseline` 的写操作受 `withWorkDirLock(workDir)` 串行保护。
- **保护分支与清理**：`manuals.protected_branches_json` 默认 `["main"]`；`DELETE /api/git/branches/*` 拒绝删除保护分支与当前活跃锁阻塞分支，删除普通分支时同步执行 `git worktree remove` 回收目录，并配合孤儿 worktree 与过期草稿资产巡检。

### 2.3 请求级隔离（衔接 ADR 0002）

每个前端请求通过 `apps/web/src/services/active-scope.ts` 携带 `x-dita-manual-id`、`x-dita-branch` 与用户身份头，服务端 `ManualContextResolver.resolve()` 按 `(manualId, workDir)` 解析独立 `WorkspaceManager` + `WorkspaceSemanticIndexer`（LRU 缓存，上限支持 `DITA_MAX_CACHED_SESSIONS` 配置并自动回收空闲会话）。

- `viewer` 角色可自由切换并浏览**已有**分支，但携带不存在分支头的只读请求会返回 `404` 而不会隐式建分支。
- 浏览器 `<img>` 加载工作区图片时无法附带自定义请求头，因此 `/api/assets/raw` 与 `/api/assets/resolve` 同时接受 `manualId`、`branch`、`userId` query 参数，确保未签入的草稿图片仅对作者本人可见。

---

## 3. 个人草稿叠加层与文件生命周期

### 3.1 SQLite 核心表结构

| 表名 | 职责 | 关键字段 / 约束 |
| :--- | :--- | :--- |
| `file_locks` | 文件级独占锁 | 唯一索引 `(project_id, branch, file_path)`；过期判定基于 `updated_at`（默认 TTL 72h，可配 `DITA_LOCK_TTL_HOURS`，支持可选 `DITA_LOCK_AUTO_RECLAIM_CLEAN` 自动回收无草稿空闲锁） |
| `working_drafts` | 个人未检入草稿 | 唯一索引 `(project_id, branch, file_path)`；`op` 取 `edit \| create \| delete \| rename`；`original_path` 记录重命名原路径；`asset_blob_path` 指向仓库外二进制暂存文件；`content_hash`（SHA-256 前 16 位）用于乐观锁校验 |
| `lock_backups` | 强解保护备份 | 管理员 `force-unlock` 前保存原持锁人草稿全文与相对 `HEAD` 的补丁 |
| `version_audit_logs` | 版本审计台账 | Append-only 记录 `checkout` / `release` / `handoff` / `cancel` / `force_unlock` / `checkin` / `branch_create` / `branch_delete` / `tag_create` / `merge` / `restore` / `revert` / `publish` |
| `publish_jobs` | 发布历史与溯源 | 记录 `source_mode`（`baseline \| tag \| commit \| my_drafts`）、`source_ref`、`commit_hash`、`is_dirty`、`dirty_files_json` |

### 3.2 状态机与操作规则

```text
未检出 (Baseline) ──checkout──▶ 已检出 (持锁, clean) ──保存/新建/删除/重命名──▶ 已检出 + working_drafts
       ▲                               │                                             │
       │                               ├─ release (仅 clean 允许)                    ├─ checkin (原子落盘→commit→释锁)
       │                               ├─ handoff (单事务转移锁 + 草稿) ──▶ 他人持锁  │
       │                               └─ cancel (单事务删草稿与锁，无需 Git) ───────┘
       └────────────── force-unlock (管理员：先写 lock_backups 再清草稿与锁) ────────┘
```

- **统一写入鉴权矩阵**：
  - `viewer`：只读，所有写/锁操作返回 `403`。
  - `writer` 与 `admin` 在持锁规则上一致：修改他人已锁文件一律返回 `409`（`admin` **不再**静默覆盖他人文件，如需接管须先 `force-unlock` 留存备份审计）；修改未锁文件或新建文件时支持按策略隐式加锁并写入个人草稿。
- **乐观并发校验（`expectedHash`）**：`GET /api/files/content` 返回当前内容 `contentHash`，`PUT /api/files/content` 携带 `expectedHash`；若多标签页或强解/还原后基线已变化则返回 `409 files.staleContent`，由前端 `ContentConflictBanner` 引导处理。
- **删除与重命名闭环**：
  - 删除已跟踪文件：在 `working_drafts` 写入 `op = 'delete'`，在当前用户的 `OverlayWorkspaceView` 树中隐藏，签入时再从 `workDir` 删除并提交，彻底消除历史版本中删除文件无法签入的死锁。
  - 重命名已跟踪文件 `a.dita → b.dita`：单事务同时锁定 `a.dita` 与 `b.dita` 并记录 `op = 'rename', original_path = 'a.dita', file_path = 'b.dita'`；按 [ADR 0003](../adr/0003-soft-assignments-in-sqlite.md)，共享任务表 `topic_assignments.topic_path` **仅在签入推进基线成功时同步更新**，草稿期不提前改写。
- **收紧 `release` + 新增 `handoff`**：存在草稿改动时 `POST /api/locks/release` 返回 `409 locks.releaseDirtyBlocked`，禁止制造无主脏文件；如需把半成品交给同事，使用 `POST /api/locks/handoff` 在单事务内完整转移锁与草稿所有权。
- **签入前置校验门禁**：前端 `CheckinDialog` 在提交前对选中草稿执行 XML 良构与 DITA 1.3 结构预检，存在阻断性错误时引导定位修复或触发 AI「检出—草稿—提交」修复闭环（详见 [checkin-validation-ai-fix.md](../plans/checkin-validation-ai-fix.md)）。
- **外部改盘兼容（桌面端 / 本地编辑器）**：`GET /api/git/status` 与签入前会检测 `workDir` 的外部 `git status --porcelain`；若存在外部改动，前端提供 `POST /api/git/external-commit` 或 `POST /api/git/external-discard`，且签入草稿与外部脏路径重叠时返回 `409 git.externalDirtyConflict` 拒绝盲覆。

---

## 4. 四大核心操作的数据视图边界

| 操作 | 读取输入源 | 写入 / 产出 | 是否受同分支他人草稿影响 |
| :--- | :--- | :--- | :--- |
| **签入（Check-in）** | 本人选中的 `working_drafts`；Diff 对比源为当前分支 `HEAD` | 原子推进 `Baseline`（落盘 `workDir` → `git commit` → 清草稿与锁 → 同步重命名委派 → 写审计 → 刷共享基线索引） | ❌ 零影响 |
| **校验（Validation）** | • 编辑器实时检查：`Editor Live XML`<br>• 跨文件语义诊断（`/api/diagnostics`）：`User Overlay` 索引（`DitaSemanticIndex.cloneWithOverlay()` 浅拷贝基线 + 本人草稿增量）<br>• DITA-OT 严格校验（`/api/validate/strict`）：默认 `scope='my_drafts'` 临时物化目录，可选 `scope='baseline'` | 只读诊断列表 | ❌ 零影响 |
| **AI 辅助（AI Authoring）** | • 目标文档：`Editor Live XML`（缺省回落 `User Overlay`）<br>• 全书语义上下文：`User Overlay` 索引 | `ask` 只读；写入型操作经 `@dita/core` 校验 + `AiDiffDialog` 确认后**仅写入当前用户的 `working_drafts`** | ❌ 零影响 |
| **发布（Publish）** | • **正式发布（默认）**：纯 `Baseline`（当前分支 `HEAD` / 指定 `Tag` / 指定 `Commit`）<br>• **个人草稿预览（可选）**：`my_drafts`（`HEAD` + 仅发布者本人草稿）<br>• HTML5 主题 Logo / 自定义 CSS 均从本次构建的 `snapshotDir` 解析 | 只读 HTML5 / PDF 产物与 `publish_jobs` 溯源记录 | ❌ 正式发布零草稿；个人预览也**只含自己草稿** |

---

## 5. 分支合并、安全回滚、Tag 与审计端点

### 5.1 无污染分支合并

- `GET /api/git/merge-preview`：使用 `git merge-tree --write-tree` 在纯内存中预检 `ahead/behind`、文件冲突与目标分支活跃锁阻塞，不触碰共享 `workDir`。
- `GET /api/git/merge-conflict`：拉取单个冲突文件的 `base` / `ours` / `theirs` 三方内容供前端 `MergeDialog`（CodeMirror MergeView）求解。
- `POST /api/git/merge`：校验用户提交的冲突解必须通过 `@dita/core` XML 良构检查，隔离合成 merge commit 并原子推进目标分支 `HEAD`，**共享 `workDir` 永不残留半截 `MERGING` 状态**。

### 5.2 安全回滚、Tag 与审计 API

| 端点 | 能力 |
| :--- | :--- |
| `GET /api/git/status` | 当前分支、ahead/behind、外部脏文件探测、个人草稿与锁摘要 |
| `GET /api/git/branches` / `POST /api/git/branches` / `DELETE /api/git/branches/*` / `POST /api/git/switch-branch` | 分支列举、基于指定基线创建、安全删分支并回收 worktree、切换分支 |
| `GET /api/git/log` / `GET /api/git/diff` / `GET /api/git/file` | 提交历史、基线/草稿 Diff、只读历史快照（`git show`） |
| `POST /api/git/restore-file` | 将某文件恢复到历史版本：支持写入个人草稿（`draft`）或直接提交（`commit`），前端同步刷新编辑器与草稿状态 |
| `POST /api/git/revert-commit` | 生成反向提交安全撤销历史 Commit；遇冲突自动 `git revert --abort`，不污染工作区 |
| `GET /api/git/tags` / `POST /api/git/tags` / `DELETE /api/git/tags/*` | 不可变发布基线标签管理，供正式发布按 Tag 复现 |
| `GET /api/git/audit` | 查询 `version_audit_logs` 版本协作审计事件流 |
| `GET /api/locks` / `POST /api/locks/{checkout,release,cancel,checkin,handoff,force-unlock}` | 独占锁与草稿叠加层全生命周期操作 |

---

## 6. 当前已知边界（非目标 / 后续演进项）

1. **纯本地 Git，无远程协作**：尚未支持 `remote` / `push` / `pull` / GitHub/GitLab 同步，多人协作限于同一 DITAEditor 服务端实例。
2. **非实时协同（无 CRDT）**：同一文件在同一分支上同一时刻仅允许一名作者持独占锁编辑；并发修改靠「多 Topic 拆分 + 同分支草稿隔离」或「多分支 + 无污染合并」解决。
3. **无重型审批流**：沿用轻量团队定位，不引入 PR 审批门禁或强制评审流（仅保留软性 Topic 任务委派与检入前校验门禁）。

---

## 7. 实现索引（改动时对照）

| 关注点 | 关键文件 |
| :--- | :--- |
| SQLite Schema（`file_locks` / `working_drafts` / `lock_backups` / `version_audit_logs` / `publish_jobs`） | `apps/api/src/db/schema.ts` |
| 个人草稿 CRUD、二进制暂存与哈希校验 | `apps/api/src/modules/locks/draft-service.ts` |
| 独占锁、原子签入、移交、取消与强解备份 | `apps/api/src/modules/locks/{lock-service,routes}.ts` |
| 叠加层文件树与读写视图、带 `userId` 的草稿资产读取 | `apps/api/src/modules/files/{overlay-workspace,routes,asset-routes,workspace-fs}.ts` |
| Git 命令、worktree 单飞与互斥锁、Tag、Restore/Revert | `apps/api/src/modules/git/{git-manager,routes}.ts` |
| 纯内存预检与无污染分支合并 | `apps/api/src/modules/git/merge-service.ts` |
| 版本协作审计台账 | `apps/api/src/modules/git/audit-service.ts` |
| 请求级手册/分支隔离与会话缓存 | `apps/api/src/modules/manuals/{manual-context-resolver,manual-registry-service}.ts` |
| 同构 `cloneWithOverlay()` 与服务端叠加语义索引 | `packages/dita-core/src/semantics/semantic-engine.ts`、`apps/api/src/modules/indexer/semantic-indexer.ts` |
| 四态发布快照（`baseline` / `tag` / `commit` / `my_drafts`）与主题资产隔离 | `apps/api/src/modules/publish/{publish-service,theme-enhancer,routes}.ts` |
| 前端版本/锁/草稿状态、冲突横幅与合并/签入弹窗 | `apps/web/src/store/{git-store.ts,editor-store/}`、`apps/web/src/components/{GitPanel,CheckinDialog,MergeDialog,LockStatusBar}.tsx`、`apps/web/src/workbench/ContentConflictBanner.tsx` |
| 前端作用域请求头与锁态辅助 | `apps/web/src/services/{active-scope,git-api,lock-helpers}.ts` |
