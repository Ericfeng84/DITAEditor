# DITA 通用 Topic（基本主题）编写规范

## 1. 概述与基本原则

### 1.1 适用范围
通用 `<topic>`（基于 `topic.dtd`）是 DITA 信息架构中所有特化主题类型（Task、Concept、Reference、Troubleshooting 等）的**基类（Base Type）**。它仅在内容**确实无法归入任何特化信息类型**时作为兜底选择，典型适用场景包括：
1. **版本发布说明（Release Notes）**：同一主题内需要按版本维度混合概述新特性、变更点与修复列表。
2. **版权声明、法律条款与免责声明（Legal & Compliance）**。
3. **章节引导页/容器主题（Container Topics）**：在 DITA Map 中作为章或节的顶层节点，仅包含标题与导读简述，用于统领下级多种类型的子主题。
4. **内容复用仓库（Warehouse Topics）**：专门用于集中存放跨文档复用的片段（如通用警告框、共享表格、变量短语）的后台资源文件。

### 1.2 核心编写原则
1. **克制使用原则（Use Sparingly）**：在成熟的 DITA 文档工程中，90% 以上的内容应采用 `task`、`concept` 或 `reference`。**严禁因懒于拆分信息类型而将所有文档都写成通用 `<topic>`**，否则会丧失 DITA 结构化校验与语义检索的核心优势。
2. **自律性结构规范（Self-Imposed Structural Discipline）**：通用 `<body>` 的 DTD 约束极为宽松（允许几乎所有块级元素任意排列）。编写者必须主动遵守严格的内部层级纪律，防止出现排版与逻辑混乱。
3. **可演进原则（Specialization-Ready）**：随着产品文档迭代，若发现某篇通用 `<topic>` 的内容逐渐偏向操作步骤或参数规格，应及时将其重构为标准的 `<task>` 或 `<reference>`。

---

## 2. 文件命名与 ID 规范

| 规范项 | 命名规则 | 正例 | 反例 |
| :--- | :--- | :--- | :--- |
| **文件名** | 全小写英文 + 下划线分隔，默认以 `topic_` 开头；若为专用工程模式（如发布说明或复用仓库），可使用约定前缀（`rn_` / `reuse_`） | `topic_legal_notice.dita`<br>`topic_security_overview.dita`<br>`rn_v2_4_0.dita`<br>`reuse_common_notes.dita` | `通用说明.dita`<br>`Overview.dita`<br>`doc1.dita` |
| **根元素 `id`** | 与文件名保持一致（不含扩展名），确保全局唯一 | `<topic id="topic_legal_notice">` | `<topic id="t1">`<br>`<topic id="topic_001">` |
| **内部元素 `id`** | 仅在需要被 `conref` 复用或交叉引用时添加，采用 `类型缩写_语义` | `<section id="sec_new_features">`<br>`<note id="note_data_backup">` | `<section id="s1">` |

---

## 3. 标准标签层级结构

在通用 `<topic>` 中，虽然 DTD 允许元素混排，但团队编写时必须遵循**“先导言区（无标题总述），后分节区（`<section>` / `<example>`）”**的规范顺序：

`topic.dtd` 的根元素与正文内容模型（DTD 真值）：

```text
topic   = (title, titlealts?, (abstract | shortdesc)?, prolog?, body?, related-links?, topic*)
body    = (body.cnt | bodydiv | example | section)*        // 无序
bodydiv = (bodydiv.cnt | bodydiv | section)*               // 无标题分组，可自嵌套，不含 example
related-links = (link | linklist | linkpool)*
```

**据此必须遵守的四条根元素约束：**

1. **`<abstract>` 与 `<shortdesc>` 互斥**：两者只能出现其一。多段落摘要用 `<abstract>`，一句话摘要用 `<shortdesc>`。
2. **`<body>` 与 `<related-links>` 均可省略**：容器主题（§4.4）可以没有 `<body>`。
3. **嵌套主题只能是 `<topic>`**：`topic.dtd` 的 `%info-types;` 仅允许 `topic`；需要嵌套 `concept` / `task` / `reference` 时必须改用 `ditabase.dtd`，否则 DTD 校验失败。
4. **`<titlealts>` 位于 `<title>` 之后、`<shortdesc>`/`<abstract>` 之前**，内容模型为 `(navtitle?, searchtitle?)`：`<navtitle>` 覆盖目录与 Map 树显示名，`<searchtitle>` 覆盖检索引擎结果标题。两者皆可省略，顺序不可颠倒。团队约定：仅当目录标题必须短于正文标题时使用，不要在两处写重复措辞。

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE topic PUBLIC "-//OASIS//DTD DITA Topic//EN" "topic.dtd">
<topic id="topic_subject_name" xml:lang="zh-CN">
  <title>清晰明确的主题标题</title>
  <shortdesc>简述本主题的核心内容与适用范围（1~2 句话）。</shortdesc>
  
  <prolog>
    <!-- 可选：元数据、作者、发布日期、关键词等 -->
  </prolog>

  <body>
    <!-- 1. 导言总述区：放置整体性背景说明、总览图或核心摘要列表 -->
    <p>整体性导言段落。</p>

    <!-- 2. 逻辑分节区：使用 <section> 组织不同维度的内容（严禁嵌套） -->
    <section id="sec_part_one">
      <title>分节标题一</title>
      <p>该分节下的具体阐述内容。</p>
      <ul>
        <li>要点列表项 1</li>
        <li>要点列表项 2</li>
      </ul>
    </section>

    <section id="sec_part_two">
      <title>分节标题二</title>
      <p>另一维度的说明内容。</p>
    </section>

    <!-- 3. 示例区（可选） -->
    <example>
      <title>示例标题</title>
      <p>具体示例说明。</p>
    </example>
  </body>

  <!-- 4. 相关链接区（可选）：引导至相关的 Task、Concept 或 Reference -->
  <related-links>
    <link href="concept_architecture.dita"/>
    <link href="task_quick_start.dita"/>
  </related-links>
</topic>
```

---

## 4. 核心元素写作细则

### 4.1 标题（`<title>`）— 必填
* **句式要求**：根据通用主题的实际用途确定句式，全书同类主题保持一致：
  * **章节容器/概述页**：采用名词短语（如“安全与合规管理”、“开发者指南概览”）。
  * **版本发布说明**：采用“版本号 + 发布说明”（如“v3.2.0 版本发布说明”）。
  * **法律与声明**：采用标准合规名称（如“隐私政策与数据保护声明”、“第三方开源软件许可声明”）。

### 4.2 简述（`<shortdesc>`）— 强烈推荐
* **功能定位**：用于说明该主题涵盖的内容边界，帮助用户在目录页或搜索结果中快速判断是否需要点击阅读。
* **写作要求**：控制在 1~2 句话内，避免使用“本主题包含以下内容：”等无意义引导语。

### 4.3 正文（`<body>`）与分节（`<section>` / `<bodydiv>`）
1. **严禁在 `<section>` 后方出现游离段落（关键规范）**：
   * 虽然基础 `topic.dtd` 在语法层面允许 `<section>` 之后再放置裸露的 `<p>` 或 `<ul>`，但在渲染输出（HTML/PDF）时，**游离段落会紧跟在上一节末尾，导致读者误以为它属于上一个 `<section>`**。
   * **强制规定**：一旦在 `<body>` 中使用了第一个 `<section>`，其后方的所有内容都必须包裹在新的 `<section>` 或 `<example>` 中。
2. **禁止 `<section>` 嵌套与伪标题**：
   * DITA 规范严禁 `<section>` 内部再嵌套 `<section>`。
   * **禁止使用加粗段落模拟子标题**（如 `<p><b>1.1 子模块说明</b></p>`）。如果主题内容复杂到需要三级标题结构，说明该文件粒度过大，必须拆分为父子多个独立的 `.dita` 文件，并通过 DITA Map 编排层级。
3. **`<bodydiv>` 的使用时机**（DITA 1.2+）：
   * 内容模型为 `(bodydiv.cnt | bodydiv | section)*`：可放 `p`/`ul`/`table`/`note` 等公共块，也可放 `<section>` 与嵌套 `<bodydiv>`，但**不能放 `<example>`**。
   * 仅当需要将多个连续元素（如“一段说明 + 一张表格 + 一条警告”）作为一个整体赋予 `id` 进行 `conref` 复用时使用，不要用它替代 `<section>`——无标题分组不进 TOC。
   * 只能出现在 `<body>` 中：`<conbody>` 用 `<conbodydiv>`、`<refbody>` 用 `<refbodydiv>`，三者不可混用。

   ```xml
   <body>
     <p>整体性导言段落。</p>
     <bodydiv id="div_upgrade_notice">
       <p>升级前请先导出当前配置。</p>
       <note type="warning">回滚需要保留上一版本的构建产物。</note>
     </bodydiv>
     <section id="sec_new_features">
       <title>新特性</title>
       <p>本节按维度组织内容。</p>
     </section>
   </body>
   ```

### 4.4 容器主题（Container Topic）专项规范
在 DITA Map 中组织多级目录时，推荐使用**省略 `<body>` 的通用 `<topic>`** 作为章/节级父节点（优于 `<topichead>`）：
* **推荐写法**：
  ```xml
  <topic id="topic_chapter_integration" xml:lang="zh-CN">
    <title>第三方系统集成</title>
    <shortdesc>介绍如何通过 Webhook、REST API 及单点登录（SSO）将本平台与企业现有工作流打通。</shortdesc>
  </topic>
  ```
* **优势**：相比仅支持导航标题的 `<topichead>`，省略 `<body>` 的 `<topic>` 既能提供高质量的 `<shortdesc>` 预览摘要，又能在发布时自动生成包含子主题摘要的着陆页（Landing Page），避免出现空白章节页。

---

## 5. 行内语义标签规范

通用 `<topic>` 继承基础高亮域（Highlight Domain）与编程/界面域。`topic.dtd`（OASIS DITA 1.3 技术内容壳）默认包含 Highlight、Programming、Software、User Interface、Utilities、Abbreviate、Equation、SVG、MathML、Indexing、Markup、Release Management 与 Hazard Statement 域，因此 `<uicontrol>`、`<wintitle>`、`<cmdname>`、`<codeph>`、`<parmname>`、`<msgnum>`、`<equation-inline>` 在 `<topic>` 中均可直接使用。

编写行内文本时，仍应遵循**语义优先于样式**的原则：
* 涉及系统界面元素时，优先使用 `<uicontrol>`、`<wintitle>`；
* 涉及命令、代码或配置字段时，优先使用 `<cmdname>`、`<codeph>`、`<parmname>`；
* 涉及首次出现的专有术语时，使用 `<term>`；
* **避免滥用 `<b>` 和 `<i>`**，仅在确实没有对应语义标签且需要强调关键词时使用。

---

## 6. 相关链接区（`<related-links>`）

`related-links` 只能包含 `link` / `linklist` / `linkpool`（DTD：`(link | linklist | linkpool)*`）：

| 子元素 | 内容模型 | 用途 |
| :--- | :--- | :--- |
| `<link>` | `(linktext?, desc?)`，`href` 必填 | 单条相关主题链接；无正文时写自闭合 `<link href="task_x.dita"/>` |
| `<linklist>` | `(title?, desc?, (linklist \| link)*, linkinfo?)` | 需要分组标题的一组链接，**顺序固定**：标题 → 说明 → 链接 → `<linkinfo>` 收尾 |
| `<linkpool>` | `(linkpool \| link)*` | 不带标题的链接池，通常由关系表（reltable）填充，手写时只放 `<link>` |

* `<linkinfo>` 每组最多一个且必须在所有链接之后，位置写错编辑器会报 `child-out-of-order`。
* 链接文字默认取目标主题 `<title>`；需要覆盖时在 `<link>` 内写 `<linktext>`，补充说明用 `<desc>`。
* 由关系表自动生成的链接不要手写第二遍，避免发布后重复。

---

## 7. 作为复用仓库主题（Warehouse Topic）的规范

在大型 DITA 项目中，通用 `<topic>` 常被用作纯后台内容仓库，存放跨主题共享的 `<note>`、`<ph>`、`<table>` 或 `<section>`：

1. **禁止直接放入目录导航**：复用仓库文件在 DITA Map 中引入时，必须设置 `processing-role="resource-only"` 属性，防止其作为独立页面被发布到最终手册中：
   ```xml
   <keydef keys="reuse_notes" href="reuse/reuse_common_notes.dita" processing-role="resource-only"/>
   ```
2. **强制全局唯一语义 `id`**：仓库文件内的每个可复用元素必须具备清晰、自解释的 `id`（如 `id="note_restart_required"`），并在上方添加 XML 注释说明该片段的适用场景，防止误删或随意修改影响下游引用方。

---

## 8. 常见反模式与自检清单

### 8.1 常见编写反模式（Anti-Patterns）

| 反模式现象 | 问题诊断 | 修正方案 |
| :--- | :--- | :--- |
| 将原本属于操作指南或 API 参数的文档直接建为 `<topic>` | “懒人兜底”反模式，导致无法利用 Task/Reference 的结构校验与统一样式渲染。 | 转换为对应的 `<task>` 或 `<reference>` 主题。 |
| 在 `<section>` 之后直接写了一段无标题的 `<p>` | 破坏逻辑归属，渲染后该段落会被视觉归入上一个 `<section>`。 | 为该段落补充独立的 `<section><title>...</title><p>...</p></section>`。 |
| 在一个 `<topic>` 中使用 `<p><b>小标题</b></p>` 制造多级子标题 | 破坏语义结构，导致目录大纲（TOC）和辅助阅读器无法识别层级。 | 按小标题拆分为多个子主题，在 DITA Map 中建立父子层级关系。 |
| 复用仓库文件未标记 `processing-role="resource-only"` | 导致后台碎片文件直接暴露在用户的搜索结果或网页目录中。 | 在 DITA Map 中统一通过 `<keydef>` 或设置 `processing-role="resource-only"` 引入。 |
| 在 `<topic>` 内直接嵌套 `<concept>` / `<task>` / `<reference>` | `topic.dtd` 的 `%info-types;` 只允许 `<topic>`，该写法 DTD 校验直接失败。 | 改用 `ditabase.dtd`，或把子主题改为同类型 `<topic>`。 |
| 用 `<bodydiv>` 替代 `<section>` 组织主要章节 | `bodydiv` 无标题、不进 TOC，读者与检索都无法定位章节。 | 章节用 `<section>`；只有为 `conref` 分组时才用 `<bodydiv>`。 |
| 在 `<bodydiv>` 内放 `<example>` | `bodydiv.content` 以 `section` 收尾，不含 `example`，DTD 校验失败。 | 把 `<example>` 提到 `<body>` 层级，或改为 `<section>` 包裹。 |
| 在 `<linklist>` 里先写 `<link>` 再补 `<title>` / `<linkinfo>` | `linklist` 是**有序**内容模型，顺序错乱会被 DTD 拒绝。 | 顺序固定为 `title → desc → link/linklist → linkinfo`。 |

### 8.2 发布前自检清单（QA Checklist）

- [ ] **必要性确认**：是否已确认该内容确实无法归入 `task`、`concept` 或 `reference`？
- [ ] 文件名与根元素 `id` 是否全小写、符合命名约定且完全一致？
- [ ] 根元素是否只用了 `<topic>` 允许的子元素，且 `<abstract>` 与 `<shortdesc>` 未同时出现？
- [ ] 嵌套子主题是否都是 `<topic>`（未混入 `concept` / `task` / `reference`）？
- [ ] `<shortdesc>` 是否准确概括了主题范围，且无冗余引导语？
- [ ] 若包含 `<body>`，是否遵循“先导言、后 `<section>`”顺序，且 `<section>` 后方无游离段落？
- [ ] 全文是否无 `<section>` 嵌套，且未使用加粗段落（`<p><b>...</b></p>`）充当子标题？
- [ ] `<bodydiv>` 是否只用于 `conref` 分组，且内部未出现 `<example>`？
- [ ] `<related-links>` 内是否只用 `link` / `linklist` / `linkpool`，且 `<linklist>` 顺序为 `title → desc → link → linkinfo`？
- [ ] 若作为复用仓库文件，是否已在 DITA Map 中正确配置 `processing-role="resource-only"`？
- [ ] 是否通过了 DITA-OT 或编辑器的 DTD/Schema 有效性校验？