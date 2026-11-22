---
title: 本地开发
description: 从零运行 DITAEditor 源码：pnpm 工作区、双服务开发、测试矩阵、演示项目与可选的本地 DITA-OT。
updated: '2026-11-22'
---

仓库是一个 pnpm workspace，包含共享内核 `@dita/core`、前端 `@dita/web`、后端 `@dita/api`，以及本官网 `@dita/site`。

## 前置条件

- Node.js 22（`>=20` 可运行，但 CI 与容器使用 22）
- pnpm 11.5.2（`corepack enable` 后由 `packageManager` 固定）
- 可选：JRE 21 与 DITA-OT 4.x，用于真实校验与发布
- 可选：Python 3 / make / g++，用于 `better-sqlite3` 在无预编译包时本地编译

## 安装与启动

```bash
corepack enable
pnpm install

# 终端 A：API（默认 http://localhost:3001）
pnpm --filter @dita/api dev

# 终端 B：Web（默认 http://localhost:5173，代理 /api）
pnpm --filter @dita/web dev
```

只想看官网与浏览器沙箱：

```bash
pnpm --filter @dita/site dev
```

## 目录速览

```text
packages/dita-core/   XML 解析/序列化、DITA 元素注册表、CALS、AI 拼接、ProseMirror
apps/api/src/modules/ git / identity / locks / files / indexer / validate / publish / dita-ot / ai / static
apps/web/src/         Topic 编辑器、Map 树、Keys 面板、发布 UI、AI 面板
apps/site/            静态官网、/playground 沙箱、docs 内容集合（本页所在处）
samples/demo-dita-project/  策展演示项目
```

## 质量门禁

改动任何代码后，在仓库根目录运行：

```bash
pnpm -r build
pnpm -r typecheck
pnpm -r test
```

常用聚焦命令：

```bash
pnpm --filter @dita/core test
pnpm --filter @dita/web test
pnpm --filter @dita/api test
pnpm --filter @dita/site test
```

`@dita/core` 的黄金回归样本位于 `packages/dita-core/test/fixtures/`。任何解析、序列化、CALS 或 ProseMirror 映射改动都必须保持这些样本逐字节往返。

## 环境变量

开发时最常用的是数据目录与 DITA-OT 路径：

```bash
export DITA_WORKSPACE_DIR="$PWD/samples/demo-dita-project"
export DITA_OT_HOME="/path/to/dita-ot"
export DITA_PUBLISH_DIR="$PWD/.tmp/publishes"
export PORT=3001
```

AI 相关变量见 [AI 接入与安全边界](/docs/ai-setup)，不要把真实密钥写入仓库文件。

## 数据库与身份

API 启动时会在数据目录创建 SQLite 数据库并执行 Drizzle 迁移。首次运行会得到可切换的本地身份（Admin / Writer / Viewer）。删除数据库文件即可重置；发布产物与 Git 仓库不会被一并删除。

## 调试建议

- **XML 往返问题**：先在 `@dita/core` 写一个最小 fixture，再定位到 `xml/` 或 `prosemirror/`；不要在前端打补丁。
- **CALS 表格异常**：检查 `namest` / `nameend` / `morerows` 与 `colspec` 是否成对，并确认表格没有多个 `tgroup`。
- **锁定冲突**：锁的键是 `(project, branch, file_path)`；切换分支后旧锁不应命中。
- **发布失败**：先跑严格校验，再检查 `DITA_OT_HOME`、Java 版本与插件安装日志。
- **AI SSE 中断**：服务端只在 `'aborted'` 或响应真正 `'close'`（且未 `writableEnded`）时取消；不要监听 `req.raw` 的 `'close'`。

## 提交前检查

1. `pnpm -r build && pnpm -r typecheck && pnpm -r test` 全绿。
2. 若改了 `@dita/core` 的 XML/CALS/PM 逻辑，附上聚焦回归测试。
3. 若改了官网内容，确认中英文两份 Markdown 都存在且结构键一致。
4. 若仓库维护了 `graphify-out/`，运行 `graphify update .` 更新知识图谱。

## 下一步

- 功能全貌：[功能导览](/docs/features)
- 部署到服务器：[快速开始与 Docker 部署](/docs/getting-started)
