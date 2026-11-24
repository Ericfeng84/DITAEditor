---
title: 快速开始与 Docker 部署
description: 用单个容器启动 DITAEditor：端口、数据卷、环境变量、首次登录、项目导入与发布验证。
updated: '2026-11-22'
---

完整工作台由同一容器提供：Fastify API、构建后的 Web 前端、SQLite 数据库、本地 Git 仓库与 DITA-OT 4.2.1。你不需要额外的数据库、缓存或消息队列。

## 前置条件

- Docker 24+（含 Compose 可选）
- 至少 2 GB 可用磁盘（DITA-OT 发行版与 Noto CJK 字体体积较大）
- 首次构建需要访问 GitHub Releases 下载 DITA-OT；受限网络见文末

## 一条命令启动

```bash
docker build -t ditaeditor:local .

docker run --rm -p 3001:3001 \
  -v ditaeditor-data:/data \
  --name ditaeditor \
  ditaeditor:local
```

打开 <http://localhost:3001>。健康检查端点为 `GET /health`。

首次启动时，入口脚本会把 `samples/demo-dita-project` 复制到 `/data/workspace`，除非该目录已经非空。因此你开箱就能看到一个完整的 DITA Map、主题、`.ditaval` 与图片资源。

## 端口与数据卷

| 项 | 默认值 | 说明 |
| --- | --- | --- |
| 容器端口 | `3001` | 由 `PORT` 控制，同时提供 API 与静态前端 |
| 数据卷 | `/data` | 工作区、导入目录、SQLite 与发布产物 |
| 工作区 | `/data/workspace` | `DITA_WORKSPACE_DIR` |
| 导入区 | `/data/workspaces` | `DITA_IMPORTS_DIR` |
| 发布产物 | `/data/publishes` | `DITA_PUBLISH_DIR` |

删除容器不会删除具名卷 `ditaeditor-data`；要完全重置，使用 `docker volume rm ditaeditor-data`。

## 关键环境变量

| 变量 | 默认 | 用途 |
| --- | --- | --- |
| `PORT` | `3001` | HTTP 监听端口 |
| `DITA_LOCK_TTL_HOURS` | 见源码 | Check-out 锁的过期小时数 |
| `DITA_PUBLISH_CONCURRENCY` | `1` | 同时运行的 DITA-OT 发布任务数 |
| `DITA_OT_HOME` | `/opt/dita-ot` | DITA-OT 安装目录 |
| `DITA_CMD` | 自动探测 | 显式指定 `dita` 可执行文件 |
| `DITAEDITOR_PDF_PLUGIN_DIR` | 内置插件目录 | Noto CJK PDF 插件位置 |
| `DITAEDITOR_NOTO_CJK_DIR` | `/usr/share/fonts/opentype/noto` | CJK 字体目录 |
| `DEEPSEEK_API_KEY` | 空 | AI 密钥的环境变量兜底 |
| `DEEPSEEK_BASE_URL` | `https://api.deepseek.com/v1` | OpenAI 兼容端点 |
| `DEEPSEEK_MODEL` | `deepseek-flash` | 默认模型 |
| `AI_TIMEOUT_MS` | 见源码 | 单次模型请求超时 |
| `AI_MAX_CONTEXT_CHARS` | 见源码 | 发送给模型的最大上下文字符数 |

数据库中的 AI 配置优先于环境变量；`GET /api/ai/config` 只返回掩码后的密钥。

## 第一次使用

1. 在右上角切换到 **Admin** 身份（本地身份切换器，用于演示角色边界），确认语言可在「中文 / EN」之间即时切换。
2. 在**手册工作台**打开内置示例手册，把某个 Topic 委派给 Writer，填写截止日期与备注；随后切换到 Writer 身份，在「我收到的」中看到该任务。
3. 进入手册的 Map 文件，确认树形结构与键空间加载正常。
4. 用 **Writer** 身份打开一个 `.dita` 主题，尝试 Check-out；另一个窗口应以 **Viewer** 或第二个 Writer 身份看到锁冲突。
5. 在任务卡片点「打开 Topic」直接定位文件，标记完成后任务从待办中消失。
6. 修改一小段正文，切到源码确认 Diff 只有一行。
7. 运行一次 **严格校验**，再发布 HTML5 与 PDF，检查日志流与产物下载。

## 导入自己的项目

把 DITA 项目放到数据卷的工作区，或在手册工作台用「接入已有目录」挂载本地路径（也可按部署配置上传 ZIP）。要求：

- Map 与主题使用标准 DITA 1.3 DOCTYPE 或 `<?xml-model?>`；
- 图片等资源使用相对路径，且随项目一起上传；
- 若依赖 `keydef`、`conref`、`.ditaval`，保持目录结构与原仓库一致。

## 验证发布

- **严格校验**使用 `--validate=yes --processing-mode=strict`，DTD/RNG 错误会带文件、行、列返回。
- **HTML5** 输出可直接静态托管。
- **PDF** 通过 `--customization.dir` 加载纯 XML 的 Noto CJK font-mappings 插件；如果中文字形缺失，先确认容器内字体目录存在，再检查插件是否安装成功。

## 常见问题

**构建阶段下载 DITA-OT 失败。** 先把官方 zip 放到构建上下文，或改用内网镜像并覆盖 `DITA_OT_VERSION` / 下载 URL。运行时不依赖外网。

**PDF 任务一直排队。** 默认并发为 1，且 DITA-OT 启动本身较重；用 `DITA_PUBLISH_CONCURRENCY` 调整，但要评估内存。

**导入后图片 404。** 检查资源相对路径是否与 Map/主题一致；发布与预览都以项目根为基准解析。

**锁一直不释放。** Admin 可以强制解锁，系统会先备份当前文件内容为补丁，再释放锁。

## 下一步

- 本地源码开发：[本地开发](/docs/local-development)
- 接入模型：[AI 接入与安全边界](/docs/ai-setup)
- 理解内部结构：[架构参考](/docs/architecture)
