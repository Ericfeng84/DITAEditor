# GitHub Pages 免费部署指南（官网 + 离线三栏工作台）

本文档说明如何通过 **GitHub Pages** 完全免费地托管 DITAEditor 的静态官网、双语文档、交互式沙箱以及**纯前端离线版三栏工作台（非完整版）**。

---

## 一、部署后的访问路径与能力边界

推送代码后，工作流 [.github/workflows/deploy-site.yml](../../.github/workflows/deploy-site.yml) 会自动构建并发布以下路径（以项目页 `https://<username>.github.io/<repo>/` 为例）：

| 路径 | 内容 | 能力边界 |
| :--- | :--- | :--- |
| `/` 与 `/en/` | 项目官网与中英双语文档站 | 纯静态 HTML/CSS，内置 Pagefind 全文搜索 |
| `/playground/` 与 `/en/playground/` | 单文件 DITA 1.3 交互沙箱 | 浏览器内运行 `@dita/core`，支持双模编辑、CALS、DITAVAL 与行级 Diff |
| `/workbench/` | **非完整版三栏工作台**（`@dita/web` 离线内存模式） | 支持内置多文件示例项目、DITA Map 树编排、多 Tab 编辑、Keyref/Conref/DITAVAL 三态过滤与本地目录导入；**不包含**服务端磁盘持久化、本地 Git/Check-out 锁、DITA-OT 严格校验/PDF 发布与服务端 AI 代理 |

> 若需使用 DITA-OT 中文 PDF 发布、本地 Git 协作锁与 AI 辅助写作，请参考 [Dockerfile](../../Dockerfile) 在本机或私有服务器运行单容器完整版。

---

## 二、一键启用步骤（约 2 分钟）

1. 将代码推送到 GitHub 仓库的 `main` 分支。
2. 在 GitHub 仓库页面打开 **Settings → Pages**：
   - **Build and deployment → Source** 选择 **GitHub Actions**。
3. 前往 **Actions → Deploy site**：
   - 如未自动触发，点击 **Run workflow** 手动运行一次。
4. 构建完成后，Pages 页面会给出公网访问地址（例如 `https://<username>.github.io/DITAEditor/`），离线工作台地址为 `<该地址>workbench/`。

---

## 三、技术细节（自动适配）

- **子路径自动适配**：工作流自动计算 `SITE_BASE`（项目页为 `/<repo>/`，用户根站点为 `/`），并以此分别构建 `@dita/site` 与 `@dita/web`（通过 `VITE_BASE=${SITE_BASE}workbench/`）。
- **零 404 离线模式**：构建 `@dita/web` 时注入 `VITE_STATIC_DEMO=true`，跳过 `/api/workspace`、`/api/identity` 与 `/api/ai/config` 启动请求，直接加载内置多文件 `demo-dita-project` 内存工作区，浏览器控制台零网络报错。
