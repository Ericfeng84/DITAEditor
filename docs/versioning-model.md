# 版本管理模型（As-Is 现状说明）

> 本文档描述 **DITAEditor 当前已实现**的版本管理与并发协作模型：仓库身份、分支与 worktree、文件级独占锁、保存/检入、撤销、历史与 Diff、发布快照，以及**已知能力缺口**。
>
> 定位：实现现状基线（as-is），用于后续演进（合并、回滚、远程协作）时对照。设计目标与路线图见 [`architecture-and-plan.md`](architecture-and-plan.md)；相关决策见 [`adr/`](adr/)；**下一阶段重构方案（Phase 13：Git 干净基线 + 个人草稿叠加层）见 [`phase13-versioning-overlay-plan.md`](phase13-versioning-overlay-plan.md) 与 [`ADR 0004`](adr/0004-baseline-and-draft-overlay.md)**。
>
> 代码基准：`apps/api/src/modules/{git,locks,files,indexer,manuals,publish}/`、`apps/web/src/store/{git-store,editor-store}/`。

---

## 0. 三层对象模型

```
Manual  (1 个独立 Git 仓库, SQLite manuals 表)
  └── Branch  (1 个分支 = 1 个物理目录: 主分支 = 项目根 / 其它分支 = git worktree)
        └── File  (1 个文件 = 1 把独占锁, 作用域 projectId + branch + filePath)
```

三层严格一一对应，**没有额外抽象层**：

- 没有 Pull Request / 合并请求，也没有"待合并提交"提示；
- 没有暴露给用户的暂存区（staging area）概念；
- 没有远程仓库（remote）、没有 push / pull / fetch。

一句话概括：**分支 = 目录，检出 = 加锁，签入 = 提交 + 解锁。**

---

## 1. 仓库身份与初始化

| 项 | 实现 |
| :--- | :--- |
| 仓库 ID | `repositoryIdFor(rootDir)` = `sha1(rootDir)` 前 16 位（`apps/api/src/modules/git/git-manager.ts:74`） |
| 初始化 | `git init -b main`，失败时回落 `git init` + `git symbolic-ref HEAD refs/heads/main`（`git-manager.ts:236`） |
| 仓库级用户 | `user.name = DITAEditor` / `user.email = dita-editor@local`；**提交时用 `-c` 覆盖为真实用户** |
| `.gitignore` | 缺失时自动写入（`git-manager.ts:248`） |
| 首个提交 | `chore: initialize DITA workspace`；空仓库允许保持 unborn（无提交）状态 |
| 远程 | 完全本地，无 push / pull / fetch |

一手册一仓库（见 [ADR 0001](adr/0001-manual-as-independent-workspace.md)），因此跨手册的 Topic 复用、分支、锁空间天然隔离。

---

## 2. 分支 = 目录（整个并发模型的地基）

### 2.1 worktree 解析

`ensureWorktree(rootDir, branch)`（`git-manager.ts:343`）：

```
branch === 主分支          → 直接返回项目根目录本身（不建 worktree）
已有 worktree 记录         → 复用其路径
记录存在但目录缺失         → git worktree prune 后重建
分支已存在                 → git worktree add <target> <branch>
分支不存在                 → git worktree add -b <branch> <target>（要求 hasCommits）
目标目录已存在             → 409 git.worktreeExists
```

- **目录布局**：`<worktreesRootDir>/<manual 目录名>-<sha1_16>/<slugify(branch)>`
  - 服务端默认：`<importsRootDir>/git-worktrees`（`apps/api/src/index.ts:91`）
  - 桌面端：`<userData>/git-worktrees`（`apps/desktop/src/paths.ts:49`）
- **slug 化**：`branch.replace(/[^A-Za-z0-9._-]+/g, '__')`（`git-manager.ts:92`），因此 `release/2.0` 的目录名是 `release__2.0`，Git 引用仍是 `release/2.0`
- **分支名校验**：`/^[A-Za-z0-9][A-Za-z0-9._/-]{0,120}$/`，并拒绝 `..`、结尾 `/`、结尾 `.lock`、开头 `-`（`git-manager.ts:78` → 400 `git.invalidBranch`）
- **目录扫描排除**：`BUILTIN_SCOPE_DIRS = { 'git-worktrees', 'publish' }`，不参与手册内容扫描与统计（`apps/api/src/modules/manuals/manual-registry-service.ts:74`）

### 2.2 请求级隔离

每个前端请求携带 `x-dita-manual-id` + `x-dita-branch`（`apps/web/src/services/active-scope.ts`），服务端 `ManualContextResolver.resolve()`（`apps/api/src/modules/manuals/manual-context-resolver.ts:99`）：

1. 按 manualId 取 `projectRootDir`
2. 解析目标分支：`请求头分支 ?? 该手册上次分支 ?? git.currentBranch(项目根)`
3. `ensureWorktree` → `workDir`
4. 按 `(manualId, workDir)` 取/建 session：`WorkspaceManager` + `new WorkspaceSemanticIndexer(workspace, branch)`，LRU 上限 16（`MAX_CACHED_SESSIONS`）
5. 无请求头的旧接口回落到"最近打开的 manual + 主分支"

**关键结论**：分支隔离是**物理目录隔离**，不是逻辑过滤。两个浏览器标签页打开不同分支 = 两份完全独立的文件副本 + 两套语义索引缓存。

---

## 3. 文件生命周期（核心状态机）

```
未检出 ──checkout──▶ 已检出(持锁) ──保存──▶ 已检出 + dirty
   ▲                     │                        │
   │                     │                        ├─ checkin ──▶ 已提交(锁释放)
   │                     ├─ release（只删锁，保留磁盘改动）──▶ 未检出 + dirty
   │                     └─ cancel （HEAD 回滚 + 删锁）─────▶ 未检出 + clean
   └──────────────── forceUnlock（管理员，先备份补丁再强解）────┘
```

### 3.1 检出（加锁，不建分支、不切分支）

`LockService.checkout()`（`apps/api/src/modules/locks/lock-service.ts:150`）：

```ts
if (user.role === 'viewer') throw 403 locks.viewerCannotCheckout;
const branch = await this.git.currentBranch(workDir);  // 目录已绑定分支
```

| 现状 | 行为 |
| :--- | :--- |
| 无锁 | 插入 `file_locks` 行 |
| 本人已锁 | 仅刷新 `updatedAt`（续期） |
| 他人已锁 | 409 `locks.checkoutConflict`，附带锁定人与锁定时间 |
| 文件不存在 | 需要 `allowMissing: true`（正常保存新文件时由写入路径自动触发） |

- **并发兜底**：`uniqueIndex('file_locks_scope_unique').on(projectId, branch, filePath)`（`apps/api/src/db/schema.ts:112`），插入冲突 → 409 `locks.alreadyCheckedOut`
- **锁 TTL 只是标记，不自动解锁**：`DEFAULT_LOCK_TTL_HOURS = 72`，可用环境变量 `DITA_LOCK_TTL_HOURS` 调整（`lock-service.ts:46-52`）；过期仅返回 `expired: true` 供 UI 提示，**仍然阻塞他人**，需管理员手动强解
- **锁不跨分支**：`release/2.0` 上锁住的 `topics/a.dita` 不会阻塞 `main` 上的同名文件

### 3.2 写入鉴权矩阵

`authorizeWrite()`（`lock-service.ts:243`）在每次落盘前调用：

| 角色 | 已存在且未锁 | 已存在 + 本人锁 | 已存在 + 他人锁 | 新文件 |
| :--- | :--- | :--- | :--- | :--- |
| viewer | 403 `locks.viewerCannotModify` | 403 | 403 | 403 |
| writer | **409 `locks.checkoutFirst`** | ✅ + 续期 | **409 `locks.saveConflict`** | ✅ 隐式自动加锁（`autoLocked: true`） |
| admin | ✅ 免锁 | ✅ | ✅ **直接覆盖，不报错、不转锁** | ✅ |

> admin 绕过锁是**刻意的救火通道**；代价是覆盖他人改动不留审计（只有强制解锁才写 `lock_backups`）。

### 3.3 保存（写盘，不提交）

`PUT /api/files/content`（`apps/api/src/modules/files/routes.ts:292`）→ `authorizeWrite()` → `ws.writeFile()`。

- 直接写 `workDir` 内的真实文件，**不产生 commit**；
- dirty 状态由 `git status` 实时计算（`git-manager.ts:390` / `statusMap` :431）；
- 同分支语义索引增量更新（`onFileWritten`）；
- 重命名 `POST /api/files/rename`（`files/routes.ts:338`）：`authorizeWrite(from)` → `renamePath` → `locks.transferLock()` 转锁 → `onFileRenamed` 索引迁移；
- 删除 `DELETE /api/files`（`files/routes.ts:372`）：同源锁校验 + 删除钩子。

### 3.4 检入（提交 + 释放锁，**唯一产生 commit 的入口**）

`LockService.checkin()`（`lock-service.ts:282`）：

1. 逐个 path 校验：必须持有本人锁（admin 可代提交）、且 `git statusMap` 显示 dirty —— 否则 409 `locks.commitNotCheckedOut` / `locks.commitByOtherWithPath` / `locks.noCommitChange`
2. `git add -A -- <paths>` → `git diff --cached --name-only -- <paths>` 为空则 409 `git.noCommitChanges`
3. `git -c user.name=… -c user.email=… commit --no-gpg-sign --no-verify --author="姓名 <邮箱>" -m <msg> -- <paths>`（`git-manager.ts:539`）
4. 删除这些 `(projectId, branch, path)` 的锁行
5. 返回 commit 信息 + 剩余锁 + 最新 status

语义要点：

- **只提交传入的 paths**（pathspec-limited commit），同分支里别人 dirty 的文件不会被带上车；
- 提交落在**当前分支的 HEAD** 上，**不会合并回 `main`**；
- 提交作者永远写真实用户（避免全仓库一个机器人作者）；
- 不跑 Git hooks、不签名（`--no-verify --no-gpg-sign`）。

### 3.5 三条撤销路径

| 操作 | 语义 | 实现 |
| :--- | :--- | :--- |
| 取消检出 | 丢弃改动，回滚到 HEAD | `git checkout HEAD -- <path>`；HEAD 无此文件则 `git rm --cached -f --ignore-unmatch` + 删除磁盘文件（`git-manager.ts:593`，`{deleted: boolean}`） |
| 释放锁 | 只解锁，**保留磁盘改动**（继续 dirty） | 仅删除锁行（`lock-service.ts:213`） |
| 强制解锁 | 管理员；先备份当前内容与 diff 补丁再删锁 | 写 `lock_backups` 后释放（`lock-service.ts:370`） |

---

## 4. 历史与差异（只读，不可回写）

| 端点 | 能力 | 实现 |
| :--- | :--- | :--- |
| `GET /api/git/status` | 分支、ahead/behind、dirty 列表、最后提交、主分支 | `git-manager.ts:390` |
| `GET /api/git/log?path=&limit=` | 分支或单文件历史，默认 30，上限 200 | `git-manager.ts:450` |
| `GET /api/git/diff?path=&from=&to=` | `to` 缺省时对比工作区；返回 old/new 文本、增删行数、二进制标记、存在性 | `git-manager.ts:492` |
| `GET /api/git/file?path=&rev=` | `git show <rev>:<path>` 只读快照 | `git-manager.ts:441` |
| `POST /api/git/discard` | 工作区文件回滚 | `git-manager.ts:593` |

**没有**：`revert`、`reset`、`checkout <commit> -- file`、分支删除、分支重命名、tag。
`architecture-and-plan.md` 中"按版本回滚"目前**未实现**——历史只能看，不能一键恢复（需取文本后手工编辑再检入）。

---

## 5. 发布（分支工作区的只读副本）

1. `POST /api/publish/jobs`：`branch` 由作用域决定，`workDir` 写入 `publish_jobs.options_json`
2. `runJob()`：`cp(sourceDir, snapshotDir, { filter })`，排除 `.git`、`.gitignore`、`.DS_Store`、`node_modules`、`dist`、`out`、`.turbo`、`.dita-workspaces`，并跳过发布目录自身（`apps/api/src/modules/publish/publish-service.ts:498`）
3. 对快照执行 DITA-OT（`--validate=yes --processing-mode=strict`）→ 可选 HTML5 主题增强 → ZIP / 在线预览
4. 任务历史按 `(projectId, branch)` 查询（`publish-service.ts:312`）；`PublishQueue` 默认并发 **1**（`apps/api/src/modules/publish/publish-queue.ts:21`）

⚠️ 快照是**工作目录 `cp`**，包含未检入的改动，不是 `git archive HEAD`。因此"发布的内容" ≈ "当前可见内容"，不等于"最后一次提交"。

---

## 6. 一致性保障

| 风险 | 手段 |
| :--- | :--- |
| 两人抢同一文件 | 锁表唯一索引 + 事务性插入 |
| 无锁写盘 | `authorizeWrite` 前置校验（admin 除外） |
| 索引陈旧 | 写入/删除/重命名/资源四类增量钩子，且与读请求同分支键 |
| 手册/分支串台 | 请求头 + 每分支独立 worktree + 每 session 独立索引器 |
| 发布被编辑干扰 | 先 `cp` 快照再构建 |
| 强制解锁丢内容 | `lock_backups` 保存全文与补丁 |
| 提交记录不可信 | commit author 强制写入真实用户 |

---

## 7. 已知能力缺口（按影响排序）长安汽车全球客户信息

全域获取与运营体系规划长安汽车全球客户信息全域获取与运营体系规划

1. **无合并**：分支永久分叉，`release/2.0` 的成果无法回到 `main`（无 merge / cherry-pick / PR / "待合并 N 个提交"提示）。
2. **无回滚**：看到历史版本改不回去，只能手工重写。
3. **发布含未检入内容**：无法区分"发布预览"与"发布定稿"。
4. **无远程协作**：不能 push 到 GitHub / GitLab；多人只能在同一服务端实例上协作。
5. **锁过期不自动回收**：72h 后仅标 `expired`，仍需管理员手动强解。
6. **worktree 无生命周期管理**：分支建了不删、删了不回收，孤儿目录依人工或 `prune`。
7. **admin 静默覆盖**：普通保存覆盖他人锁文件不留审计（仅强解有备份）。
8. **无保护分支**：除 `main` 外没有 protected 概念，任何人可创建 `main2`、`prod` 之类语义分支。
9. **无审计日志**：除 Git 提交、`lock_backups`、`publish_jobs` 外，没有统一的"谁在何时改了锁/发布了什么"事件流。

---

## 8. 一次完整编辑的时序

```
① 打开手册 /manuals/:id       → setActiveScope(manualId, branch)，此后请求均带 x-dita-*
② 点开 Topic（只读）          → GET /api/files/content（+ 语义索引 overlay、conref 解析）
③ 点「检出」                  → POST /api/locks/checkout → file_locks 插行
④ 编辑 + 自动保存             → PUT /api/files/content → 写 workDir → 索引增量
                                （git status = dirty，未提交）
⑤ 点「签入」                  → CheckinDialog 预览 diff（GET /api/git/diff，工作区 vs HEAD）
⑥ 填写提交说明并提交          → POST /api/locks/checkin → git add/commit 到当前分支
                                → 删除锁行 → 可选结单 Assignment
⑦ 发布                      → cp 工作区快照 → DITA-OT → 主题增强 → ZIP/预览
⑧ 其他人 / 其他分支           → 不同目录、不同锁空间，互不可见
```

---

## 9. 实现索引（改动时对照）

| 关注点 | 文件 |
| :--- | :--- |
| Git 命令封装、worktree、diff、commit、discard | `apps/api/src/modules/git/git-manager.ts` |
| Git HTTP 端点 | `apps/api/src/modules/git/routes.ts` |
| 锁生命周期与写入鉴权 | `apps/api/src/modules/locks/lock-service.ts` |
| 锁 HTTP 端点 | `apps/api/src/modules/locks/routes.ts` |
| 锁表 / 备份表 / 发布任务表 | `apps/api/src/db/schema.ts` |
| 文件读写端点（写入鉴权入口） | `apps/api/src/modules/files/routes.ts` |
| 手册 → 分支 → worktree 会话 | `apps/api/src/modules/manuals/manual-context-resolver.ts` |
| 分支维度的语义索引 | `apps/api/src/modules/indexer/semantic-indexer.ts` |
| 发布快照与队列 | `apps/api/src/modules/publish/{publish-service,publish-queue}.ts` |
| 前端 Git/锁状态 | `apps/web/src/store/{git-store,editor-store}/` |
| 作用域请求头 | `apps/web/src/services/active-scope.ts` |
