# DITAEditor 内置演示手册

这个目录是 DITAEditor 自带的示例工作区：一本用标准 DITA 1.3 写的《DITAEditor 产品手册》。它同时承担三件事——首次启动时打开的演示内容、DITA 功能（复用、条件化、CALS 表格、特化元素）的可运行样例，以及端到端测试的固定夹具。

## 内容地图

```text
demo-dita-project/
├── product-manual.ditamap      # 根地图（唯一根级地图，默认打开）：键定义、子地图、reltable
├── maps/
│   ├── getting-started.ditamap # 操作任务子地图
│   ├── reference-guide.ditamap # 参考资料子地图
│   └── admin-book.ditamap      # 同一批主题的另一本书，键值覆盖演示（切换根地图时使用）
├── concepts/                   # 概念：DITA 模型、单一信息源、工作区、工作台、流程、AI 与导入
├── tasks/                      # 任务：Map 编排、服务端启动、中文 PDF 字体
├── references/                 # 参考：元素速查、CALS 表格、API、镜像与环境变量、发布主题、特化元素
├── shared/common-reuse.dita    # 复用仓库：被 conref / conkeyref 引用的片段
├── filters/                    # DITAVAL：cloud-edition、onprem-admin
└── images/                     # 两张 SVG 示意图（架构、流程）
```

## 这份手册演示了什么

| DITA 能力 | 出现位置 |
| --- | --- |
| 多级 topicref、topichead、mapref 子地图 | `product-manual.ditamap`、`maps/*.ditamap` |
| 键定义与键空间（含 `keyscope`） | 根地图的 `prod_name`、`api_version`、`deployment_mode`、`cloud.endpoint_url` |
| `keyref`、`conkeyref`、`conref` | `concepts/single-sourcing.dita`、`shared/common-reuse.dita` |
| 条件化（`product`、`audience`、`otherprops`、`platform`） | `concepts/workspace-model.dita`、两个 DITAVAL |
| CALS 表格（`namest`/`nameend`、`morerows`） | `references/server-sizing-cals.dita` |
| 特化与未知元素的无损透传 | `references/specialized-passthrough.dita`（`<?xml-model?>`、注释处理指令、`hazardstatement`、`screen`） |
| reltable 关联关系 | `product-manual.ditamap` |
| `xml:lang` 混合语言 | `references/specialized-passthrough.dita` 为 `en-US` |

## 如何使用

1. 启动工作台（`pnpm --filter @dita/web dev` + `pnpm --filter @dita/api dev`，或 `docker compose up -d`），默认打开的就是本目录。
2. 在 Map 结构树里展开 `product-manual.ditamap`，点任意主题即可在可视化与源码之间切换。
3. 想验证条件化：发布时选择 `filters/cloud-edition.ditaval` 与 `filters/onprem-admin.ditaval` 对比产物差异。
4. 想验证「一处改、处处同步」：改 `shared/common-reuse.dita` 里的 `backup_warning`，回到引用它的主题查看结果。
5. 想验证键值覆盖：把根地图从 `product-manual.ditamap` 切到 `maps/admin-book.ditamap`，同一批主题会换成《私有化部署与运维手册》的产品名与部署形态。两本书分开放在根级时，工作台按路径顺序挑第一本，默认会落到 `admin-book.ditamap`；因此第二本书收在 `maps/` 下，让根级只留一本默认根地图。

## 关于这个目录的 Git 仓库

本目录自带一个独立的 Git 仓库，用来演示 DITAEditor 的分支、检出锁与草稿叠加层。它是演示数据，可以被随意重置：删掉本目录再重新检出仓库，或让桌面端在全新的数据目录下重新播种，即可恢复到出厂状态。

## 修改约定

- 只写真实存在的功能与路径。内容面向使用手册的读者，不写 `rawAttrs`、`ProseMirror` 之类的实现词汇。
- 主题路径、地图名与键名被 `apps/api/test/semantics-api.test.ts` 等测试引用，重命名时请同步更新断言。
- 保存后请确认没有结构诊断：结构提醒只是引导，但出厂内容应当零告警。
