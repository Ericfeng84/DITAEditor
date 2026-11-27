---
title: DITA 1.3 规范速查
description: 面向写作者的 DITA 1.3 技术内容速查：四种主题类型的内容模型、常用元素与属性、Map 与 key、DITAVAL 条件处理、命名约定与常见误区。
updated: '2026-11-28'
---

本页不是规范的替代品，而是**写作时最常查的那一页**：四种主题类型的必需结构、主流元素与属性的写法、Map 与 key 的组织方式，以及 DTD 校验最常报错的地方。权威定义始终以 [OASIS DITA 1.3 Part 2: Technical Content Edition](https://docs.oasis-open.org/dita/dita/v1.3/dita-v1.3-part2-tech-content.html) 与 [Part 3: All-Inclusive Edition](https://docs.oasis-open.org/dita/dita/v1.3/dita-v1.3-part3-all-inclusive.html) 为准。

工作台内的「帮助 → DITA 1.3 速查」与这里同源：元素名称、说明、必需属性都从 `@dita/core` 的元素注册表与内容模型实时生成，因此核对的永远是同一份规则。

## 四种主题类型

| 类型 | 用途 | 必需结构 | 正文容器 |
| --- | --- | --- | --- |
| `<concept>` | 解释「是什么」：原理、模型、背景 | `<title>` | `<conbody>` |
| `<task>` | 写「怎么做」：可执行步骤 | `<title>` | `<taskbody>` |
| `<reference>` | 列「参数与规格」：CLI、API、字段 | `<title>` | `<refbody>` |
| `<topic>` | 通用容器，类型暂不确定时 | `<title>` | `<body>` |

选择判据是**内容意图**，不是篇幅：读完之后要读者「理解」用 concept，「照做」用 task，「查阅」用 reference。类型混写在 DITA 里代价很高，因为正文容器的内容模型完全不同。

所有主题共享的外壳：

```text
topic      = (title, titlealts?, (shortdesc | abstract)?, prolog?, body?, related-links?)
concept    = (title, titlealts?, (shortdesc | abstract)?, prolog?, conbody?, related-links?, concept*)
task       = (title, titlealts?, (shortdesc | abstract)?, prolog?, taskbody?, related-links?, task*)
reference  = (title, titlealts?, (shortdesc | abstract)?, prolog?, refbody?, related-links?, reference*)
```

## 有序内容模型

只有真正有顺序要求的容器才需要记顺序，其余是 `|` 无序选择。

```text
conbody    = ((body.cnt)*, (section | example | conbodydiv)*)
taskbody   = (prereq?, context?, (steps | steps-unordered)?, result?,
              tasktroubleshooting?, example?, postreq?)
refbody    = (refsyn | properties | section | example | simpletable | table | refbodydiv)*
ul         = (title?, (li)+)          // 至少一个 <li>
ol         = (title?, (li)+)
table      = (title?, desc?, tgroup+)
```

`<taskbody>` 是严格任务模型（`strictTaskbodyConstraint.mod`）。如果你确实要自由排布，需要在 shell 里改用 `generalTask.dtd` / `ditabase.dtd`——工作台把两者分别建模为 strict 与 general 两种任务模型，选择 shell 后校验与插入菜单一起切换。

## 常用块级元素

| 元素 | 说明 |
| --- | --- |
| `<p>` | 段落。`<p>` 里可以放内联元素与列表等块，但正文容器本身各有规则 |
| `<shortdesc>` | 一到两句话说明主题价值，进入搜索结果摘要与 Map 预览 |
| `<section>` | 分节容器，必须带 `<title>`；不能嵌套 `<section>`（用 `<sectiondiv>`） |
| `<example>` | 示例区，通常放在正文末尾 |
| `<note>` | 提示；`type="note/tip/important/warning/danger"` 决定排版强度 |
| `<ul>` / `<ol>` / `<li>` | 无序 / 有序列表 |
| `<dl>` / `<dlentry>` / `<dt>` / `<dd>` | 定义列表 |
| `<fig>` / `<image>` | 图与图片，`href` 用相对路径 |
| `<table>` | CALS 表格：`<tgroup>` → `<colspec>` → `<thead>` / `<tbody>` → `<row>` → `<entry>` |
| `<simpletable>` | 无合并需求的简单表格 |
| `<codeblock>` | 代码块，保留空白（`xml:space="preserve"`） |
| `<lines>` | 需要保留换行但不希望等宽排版的行 |
| `<xref>` | 交叉引用，`href` 或 `keyref` |

## 常用内联元素

| 元素 | 说明 |
| --- | --- |
| `<b>` `<i>` `<u>` | 加粗、斜体、下划线 |
| `<codeph>` | 行内代码 |
| `<cmdname>` | 命令名 |
| `<filepath>` | 路径 |
| `<userinput>` | 用户输入 |
| `<systemoutput>` | 系统输出 |
| `<wintitle>` | 窗口与对话框标题 |
| `<keyword>` | 关键词，可参与 keyref 与检索 |
| `<ph>` | 短语容器，适合挂 `conref` / `keyref` |
| `<term>` | 术语 |
| `<option>` | 选项 / 参数名 |
| `<apiname>` | API 名称 |
| `<fn>` | 脚注 |

## 常用属性

| 属性 | 说明 |
| --- | --- |
| `id` | 元素标识。主题根元素**必填**；内部元素只在需要被 conref / xref 引用时添加 |
| `xml:lang` | 内容语言，写在根元素上，例如 `zh-CN` / `en-US` |
| `conref` | 内容引用，指向仓库片段的 `id` |
| `conkeyref` | 通过 key 间接引用，主题换库时只改 key 定义 |
| `keyref` | 关键词或链接的 key 引用；与 `href` 同时存在时 keyref 优先 |
| `href` | 目标地址（内部相对路径或外部 URL） |
| `scope` | `local` / `peer` / `external`，外部链接必须写 `external` |
| `format` | 目标格式，如 `dita` / `html` / `pdf` / `markdown` |
| `audience` | 受众条件，参与 DITAVAL 过滤 |
| `platform` | 平台条件 |
| `product` | 产品条件 |
| `props` | 自定义条件属性（可派生特化） |
| `outputclass` | 输出样式钩子，主题用它挂样式 |
| `importance` | 内容重要度（`required` / `recommended` / `optional`） |

命名与文件约定：

- 文件名全小写英文、下划线分隔，并按类型加前缀：`concept_rbac_model.dita`、`task_install_server.dita`、`reference_api_errors.dita`。
- 根元素 `id` 与文件名主干一致，保证跨手册唯一。
- 每篇一个 `<title>`；`<shortdesc>` 一到两句。
- `xml:lang` 写在根元素；中英混排内容各自成篇，不要靠 `translate="no"` 在同一主题里切换语言。

## Map、topicref 与 key

```xml
<map id="map_product_guide" xml:lang="zh-CN">
  <topicmeta>
    <shortdesc>产品手册总装图。</shortdesc>
  </topicmeta>

  <topichead navtitle="入门">
    <topicref href="concepts/product_overview.dita"/>
    <topicref href="tasks/install_server.dita"/>
  </topichead>

  <topicref href="references/api_errors.dita" keys="api-errors"/>
  <keydef keys="product_name" href="concepts/glossary_product.dita#glossary_product/prod_name"/>
</map>
```

- `topicref` 决定导航树与合并输出顺序；`topichead` 只做分组标题，不指向文件。
- `keys` 定义可被 `keyref` 引用的名字；`keydef` 定义不进入导航的纯 key。
- 同一 key 在 map 层级里被覆盖时，**最近的定义胜出**，这是多产品复用同一套主题的常用手法。
- 缺失 key、指向不存在文件的 `topicref` 都会进入跨文件诊断，定位到文件与行。

## DITAVAL 条件处理

```xml
<val>
  <prop att="audience" val="internal" action="exclude"/>
  <prop att="platform" val="windows" action="include"/>
  <prop att="product" val="legacy" action="flag" color="red" backcolor="yellow"/>
</val>
```

- `action` 三选一：`include`（保留）、`exclude`（排除）、`flag`（保留并标记）。
- 过滤只影响显示与发布投影，**不会删除 XML 里的任何条件属性**。
- 组合过滤顺序：先 `exclude` 再 `flag`；同一元素命中多条规则时按 DITAVAL 文档顺序求值。

## 复用与特化

- **conref**：`<ph conref="../common/reuse.dita#reuse/prod_name"/>`，取被引用元素本身。
- **conkeyref**：`<ph conkeyref="product_name"/>`，把「引用哪个文件」变成「引用哪个 key」。
- **特化（specialization）**：通过 DTD/RNG 约束模块定义新的元素类型与属性域，`class` 属性保留继承链。工作台把未建模的元素一律当作 `unknown_block` / `unknown_inline` 原样透传，因此特化内容不会在往返中丢失。

## 常见误区

1. **`<conbody>` 里先写 `<section>` 再补段落**：有序模型要求段落在前，诊断会报 `child-out-of-order`。
2. **用 `<p>` 包住整段操作步骤**：任务语义与 PDF/HTML 排版都依赖 `<steps>` / `<step>` / `<cmd>` 结构。
3. **在 `<refbody>` 里直接写 `<p>` / `<ul>`**：`refbody` 只接受 `refsyn` / `properties` / `section` / `example` / `simpletable` / `table` / `refbodydiv` 等结构化容器，基本块必须放进 `<section>` 或 `<refsyn>`。
4. **`<properties>` 塞进 `<section>`**：它只能直接挂在 `<refbody>` 或 `<refbodydiv>` 下，且没有 `<title>`。
5. **`<section>` 里放 `<example>`**：`section.cnt` 不含 `example`；要分组请用 `<sectiondiv>`。
6. **把表格当排版工具**：跨行跨列用 `namest` / `nameend` / `morerows` 表达，而不是塞空单元格。
7. **在 conref 目标元素上挂条件属性**：引用只取元素本身，多余的 `audience` / `props` 会让过滤结果与预期不符。
8. **直接手改投影里的复用内容**：投影只读，修改必须回到源片段，否则下次解析就被覆盖。

## 权威参考

- [OASIS DITA 1.3 Part 2: Technical Content Edition](https://docs.oasis-open.org/dita/dita/v1.3/dita-v1.3-part2-tech-content.html) — 元素内容模型、属性与语义
- [OASIS DITA 1.3 Part 3: All-Inclusive Edition](https://docs.oasis-open.org/dita/dita/v1.3/dita-v1.3-part3-all-inclusive.html) — 含 LangRef 与全部规范正文
- [DITA Open Toolkit 文档](https://www.dita-ot.org/) — 校验与发布工具链、插件机制与发行说明
