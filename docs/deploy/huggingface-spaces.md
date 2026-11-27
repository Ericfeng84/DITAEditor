# Hugging Face Spaces 部署指南（Docker 单容器方案）

> **提示**：如仅需免费在线演示而不想绑定计费方式，推荐改用 **GitHub Pages 免费部署非完整版（官网 + 离线三栏工作台）**，详见 [github-pages.md](./github-pages.md)。

本文档说明如何将 **DITAEditor 完整版单容器工作台**（含 ProseMirror / CodeMirror 双模编辑、Map 树、Keys/Conref/DITAVAL、本地 Git 与 Check-out 独占锁、DITA-OT 4.2.1 严格校验与 Noto CJK 中文 PDF 发布）部署到 **Hugging Face Spaces（Docker SDK）**。

> **为什么 Hugging Face Spaces 适合 DITAEditor？**  
> 免费 `CPU basic` 规格提供 **2 vCPU / 16 GB RAM**，足以稳定运行 JRE 21 + DITA-OT 4.2.1 + Apache FOP 中文 PDF 发布，不会像 512 MB 免费 PaaS 那样 OOM。

---

## 已内置的 Hugging Face 兼容适配

仓库已完成以下开箱适配，无需维护第二份 `Dockerfile`：

1. **非 root `UID 1000`（`USER node`）运行**：[Dockerfile](../../Dockerfile) 在运行时切换为 `node`（UID 1000），预先创建并授权 `/data`、`/home/node/.fop`、`/home/node/.cache`、`/opt/dita-ot/temp`，并配置 `git config --system --add safe.directory '*'`。
2. **非 root 安全初始化演示项目**：[docker-entrypoint.sh](../../docker-entrypoint.sh) 使用 `cp -R` 初始化 `/data/workspace`，避免 `UID 1000` 复制镜像文件时因尝试保留 `root` 属主报错。
3. **Space 元数据与端口对齐**：[deploy/huggingface/README.md](../../deploy/huggingface/README.md) 声明 `sdk: docker` 与 `app_port: 3001`，与镜像默认 `PORT=3001` 及健康检查 `/health` 完全一致。
4. **精简推送包**：[scripts/sync-hf-space.sh](../../scripts/sync-hf-space.sh) 只打包工作台 Docker 构建所需源码（剥离 `docs/pic/`、官网源码、`node_modules` 与 `.github/`），避免大文件与工作流权限拦截。

---

## 第一步：在 Hugging Face 创建空白 Docker Space

1. 登录 [Hugging Face Spaces](https://huggingface.co/spaces) 并点击 **Create new Space**。
2. 填写基本配置：
   - **Space name**：例如 `dita-editor`
   - **License**：`MIT`
   - **Select the Space SDK**：选择 **Docker** → 模板选 **Blank**
   - **Space hardware**：免费 **CPU basic (2 vCPU · 16 GB)**
   - **Visibility**：`Public`（公开免费体验）或 `Private`（个人私有体验）
3. 前往 [Settings → Access Tokens](https://huggingface.co/settings/tokens) 生成一个 **Write** 权限的 Token（用于推送 Space 仓库）。

---

## 第二步：推送部署（二选一）

### 方式 A：通过 GitHub Actions 一键自动同步（推荐）

仓库已内置工作流 [.github/workflows/deploy-hf-space.yml](../../.github/workflows/deploy-hf-space.yml)：

1. 在你的 GitHub 仓库进入 **Settings → Secrets and variables → Actions**：
   - **Secrets** 新增：`HF_TOKEN` = 第一步生成的 Hugging Face Write Token
   - **Variables** 新增：`HF_SPACE_REPO` = `<你的HF用户名>/dita-editor`（例如 `fengkang/dita-editor`）
2. 进入仓库 **Actions → Deploy to Hugging Face Spaces → Run workflow** 手动触发首次部署。
3. 之后每次在 GitHub 发布新的 **Release** 时会自动同步最新工作台到 Space（也可随时手动触发）。

### 方式 B：本地命令行一键推送

先执行 `--dry-run` 检查打包文件清单（不会触发推送）：

```bash
chmod +x scripts/sync-hf-space.sh
./scripts/sync-hf-space.sh --dry-run
```

确认无误后推送到你的 Space：

```bash
HF_SPACE_REPO="<你的HF用户名>/dita-editor" \
HF_TOKEN="hf_xxxxxxxxxxxxxxxxxxxx" \
./scripts/sync-hf-space.sh
```

> 首次推送后，Hugging Face 云端会自动执行 `Dockerfile` 构建（安装 pnpm 依赖、编译三包、拉取 DITA-OT 4.2.1 与 Noto CJK 字体），大约需要 **4–8 分钟**；可在 Space 页面顶部 **Logs → Build** 查看进度，状态变为 **Running** 后即可访问。

---

## 第三步：环境变量与安全建议（必读）

在 Space 页面的 **Settings → Variables and secrets** 中按需配置：

| 变量名 | 默认值 | 说明 |
| :--- | :--- | :--- |
| `DITA_PUBLISH_CONCURRENCY` | `1` | 同时运行的 DITA-OT 发布任务数，2 vCPU 免费档建议保持 `1` |
| `DITA_PUBLISH_TIMEOUT_MS` | `300000` | 单次 DITA-OT 发布超时时间（毫秒） |
| `DEEPSEEK_API_KEY` | *留空* | **安全警告**：工作台采用团队内网免密码身份切换，任何访客均可切换为 `Admin` 角色并调用 AI。**公开 Space 强烈建议留空**，切勿配置个人高额度密钥！ |
| `DEEPSEEK_BASE_URL` | `https://api.deepseek.com/v1` | 仅在 **Private Space** 个人自用时配置 |
| `DEEPSEEK_MODEL` | `deepseek-flash` | 仅在 **Private Space** 个人自用时配置 |

---

## 持久化存储与休眠行为说明

- **免费档（无持久卷）**：
  - 超过 48 小时无访问后 Space 会自动休眠，下次打开需等待约 10–30 秒冷启动。
  - 每次重启/重建后，`/data` 会重新初始化为内置演示项目 `samples/demo-dita-project/`，天然适合作为**公共在线 Demo**。
- **开启 Persistent Storage（付费可选）**：
  - Hugging Face Persistent Storage 会自动挂载到容器的 **`/data`** 目录，与镜像内 `DITA_WORKSPACE_DIR=/data/workspace`、`DITA_IMPORTS_DIR=/data/workspaces`、`DITA_PUBLISH_DIR=/data/publishes` 完全对齐，开启后 SQLite 锁/身份库、本地 Git 仓库与发布产物均可跨重启保留。

---

## 常见问题排查

1. **构建日志卡在下载 DITA-OT 或偶发网络抖动**  
   在 Space 右上角菜单点击 **Factory reboot** 重新构建即可（镜像内 `curl` 已配置 `--retry 3`）。
2. **页面一直显示 Building / Starting 无法打开**  
   检查 Space 仓库根目录 `README.md` 顶部是否存在 `app_port: 3001`，并确认没有在 Space Variables 中覆盖冲突的 `PORT` 值（若把 `PORT` 改为 `7860`，需同步将 `app_port` 改为 `7860`）。
3. **PDF 导出验证中文是否正常**  
   在左侧「Map 树」选中 `product-manual.ditamap` → 点击「发布」→ 选择 `PDF` 格式提交构建，完成后在线预览生成的 PDF 即可确认 Noto CJK 中文字体正常嵌入。
