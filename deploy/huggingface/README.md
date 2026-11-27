---
title: DITAEditor
emoji: 📝
colorFrom: blue
colorTo: slate
sdk: docker
app_port: 3001
suggested_hardware: cpu-basic
short_description: Lightweight Web DITA 1.3 workbench with lossless XML, Git locks & DITA-OT PDF
license: mit
pinned: false
---

# DITAEditor — Web DITA 1.3 Workbench (Live Demo)

面向技术文档团队的轻量级 **Web DITA 1.3 结构化写作工作台**在线演示实例（基于 Docker 单容器镜像，内置 DITA-OT 4.2.1 与 Noto CJK 中文字体）。

A lightweight **Web DITA 1.3 structured authoring workbench** running in a single Docker container with built-in DITA-OT 4.2.1 and Noto CJK fonts.

## What You Can Try Here / 可体验的核心能力

- **Lossless Dual-Mode Editing（双模无损编辑）**：ProseMirror 可视化结构化编辑 + CodeMirror 6 XML 源码编辑，100% 保留 `<!DOCTYPE>`、XML 注释、PI、CALS 表格与原始属性顺序。
- **DITA Map Tree（可视化目录树）**：拖拽调整层级、右键新建并挂载 Topic、查看 Map 源码。
- **Single-Sourcing Engine（单一信息源语义引擎）**：Root Map BFS `keydef/keyref`、`conref/conkeyref` 只读展开与环路检测、`.ditaval` 三态实时条件过滤。
- **Local Git & Check-out Locks（本地 Git 与独占锁）**：工具栏免密码切换身份（管理员 / 写作 / 只读），体验文件检出、工作区 Diff、提交历史与签入。
- **DITA-OT 4.2.1 Strict Validation & Publishing（官方严格校验与发布）**：一键运行 OASIS DITA 1.3 DTD/RNG 严格校验，并异步发布 **HTML5（在线预览 + ZIP）** 与 **中文无乱码 PDF（Noto CJK）**。

## Public Demo Notes / 公共演示说明

- **Ephemeral Storage（临时存储）**：免费 Space 重启或休眠唤醒后，`/data` 会自动重置为内置的 `demo-dita-project` 示例项目；请勿在公开演示实例中存放正式或敏感文档。
- **AI Assistant（AI 助手）**：为防止密钥滥用，公共演示实例默认未配置服务端大模型 Key；如需体验 DeepSeek / 私有化 OpenAI 兼容代理辅助写作，请使用单容器镜像在本地或团队内网自托管部署。
- **Self-Hosting（私有化部署）**：详见仓库文档 `docs/deploy/huggingface-spaces.md` 与 `Dockerfile`。
