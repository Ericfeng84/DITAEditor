# DITA Concept（概念）主题编写规范

## 1. 概述与基本原则

### 1.1 适用范围
本规范适用于基于 DITA（Darwin Information Typing Architecture）标准编写的所有背景介绍、原理解析、架构说明及术语定义类技术文档（Concept Topic）。Concept 主题旨在回答用户**“这是什么（What is it）”**以及**“为什么重要/如何运作（Why & How it works）”**。

### 1.2 核心编写原则
1. **客观阐述原则（Explanatory & Descriptive）**：Concept 主题聚焦于系统设计理念、核心机制、组件关系及业务价值，采用陈述性、客观的语言进行解释。
2. **信息类型纯粹性（Strict Information Typing）**：
   * 仅阐述理解产品或功能所需的背景知识。
   * 具体的分步操作指南 $\rightarrow$ 拆分为 **Task（任务）** 主题，在 Concept 末尾通过 `<related-links>` 或 `<xref>` 引导。
   * 详尽的参数规格表、命令语法、错误码大全 $\rightarrow$ 拆分为 **Reference（参考）** 主题。
3. **图文并茂与结构化分段**：对于复杂的系统架构、数据流转或状态机生命周期，优先使用架构图（`<fig>`）、定义列表（`<dl>`）和分段标题（`<section>`）降低阅读认知负荷，避免大段无分层的纯文本堆砌。

---

## 2. 文件命名与 ID 规范

| 规范项 | 命名规则 | 正例 | 反例 |
| :--- | :--- | :--- | :--- |
| **文件名** | 全小写英文 + 下划线分隔，以 `concept_` 开头，体现核心名词概念 | `concept_rbac_model.dita`<br>`concept_data_lifecycle.dita` | `权限模型.dita`<br>`RBACModel.dita`<br>`about_rbac.dita` |
| **根元素 `id`** | 与文件名保持一致（不含扩展名），确保全局唯一 | `<concept id="concept_rbac_model">` | `<concept id="c1">`<br>`<concept id="concept_001">` |
| **内部元素 `id`** | 仅在需要被 `conref` 复用或交叉引用时添加，采用 `类型缩写_语义` | `<section id="sec_core_components">`<br>`<dlentry id="dl_access_token">` | `<section id="s1">` |

---

## 3. 标准标签层级结构

相比 `<taskbody>`，`<conbody>` 支持段落、列表、图表与多个 `<section>`、`<example>`、`<conbodydiv>` 组合。但它的 DTD 模型是**有序**的：

```text
conbody = ((body.cnt)*, (section | example | conbodydiv)*)
```

也就是“基础块”必须全部在前，“分节/示例/分区”必须全部在后（顺序不能交叉）。因此组织内容时应遵循**“先总述（无标题段落/总览图），后分述（`<section>` 与 `<example>`）”**的布局规范：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">
<concept id="concept_subject_name" xml:lang="zh-CN">
  <title>名词短语形式的概念标题</title>
  <shortdesc>用 1~2 句话定义该概念的核心含义及其解决的业务问题。</shortdesc>

  <prolog>
    <!-- 可选：元数据、关键词、受众角色等 -->
  </prolog>

  <conbody>
    <!-- 1. 开篇总述区：直接放置 <p>、<fig>、<dl> 等，作为概念的整体引入 -->
    <p>整体定义与核心价值说明。</p>

    <fig id="fig_architecture">
      <title>系统架构示意图</title>
      <desc>展示核心组件之间的交互与数据流向。</desc>
      <image href="images/architecture.png" placement="break">
        <alt>系统架构图</alt>
      </image>
    </fig>

    <!-- 2. 分节详述区：使用 <section> 划分逻辑维度
         注意：<section> 严禁相互嵌套，也不能在 <section> 内嵌 <example>；
         需要把多个分节/示例归为一组时，用 DITA 1.3 的 <conbodydiv> 包裹。
         分节内部需要再分组时，用 DITA 1.3 的 <sectiondiv>。 -->
    <section id="sec_key_features">
      <title>核心特性</title>
      <dl>
        <dlentry>
          <dt>特性名称 A</dt>
          <dd>特性 A 的具体原理与业务价值说明。</dd>
        </dlentry>
        <dlentry>
          <dt>特性名称 B</dt>
          <dd>特性 B 的具体原理与业务价值说明。</dd>
        </dlentry>
      </dl>
    </section>

    <section id="sec_workflow">
      <title>工作机制</title>
      <p>阐述内部处理流程或状态流转逻辑。</p>
    </section>

    <!-- 3. 场景示例区：通过具体业务场景帮助用户具象化理解概念 -->
    <example>
      <title>典型应用场景示例</title>
      <p>描述某企业如何利用该机制解决实际业务问题的案例。</p>
    </example>
  </conbody>
</concept>
```

> **关于省略 `<conbody>` 的特别说明**：在 DITA 语法中，`<conbody>` 属于可选元素（`concept = (title, titlealts?, (abstract | shortdesc)?, prolog?, conbody?, related-links?, concept*)`）。当某 Concept 主题在 DITA Map 中仅作为**章/节级父容器主题**汇总多个下级概念或任务时，可仅保留 `<title>` 与 `<shortdesc>`，省略 `<conbody>`。独立的叶子节点概念主题严禁省略 `<conbody>`。
>
> 另外三点同属根元素模型：
> * `<shortdesc>` 与 `<abstract>` **互斥**，二者只能取其一（`<abstract>` 内还可再写 `<shortdesc>`）；
> * 标题别名（导航显示名等）放在 `<title>` 之后的 `<titlealts><navtitle>…</navtitle></titlealts>`；
> * `concept.dtd` 允许 `<concept>` 内嵌 `<concept>` 作为子主题，但**不允许**内嵌 `<task>`/`<reference>`（各主题类型的 DTD 只把自身类型列入 `info-types`）。

---

## 4. 核心元素写作细则

### 4.1 标题（`<title>`）— 必填
* **句式要求**：必须采用**名词短语**或**动名词短语**，直接点明所阐述的对象或机制。
  * *正例*：“基于角色的访问控制（RBAC）”、“分布式事务一致性模型”、“Webhook 事件机制”。
  * *反例*：“了解 RBAC”（祈使句，易与 Task 混淆）、“什么是分布式事务”（避免在正式技术文档中使用疑问句作标题）。

### 4.2 简述（`<shortdesc>`）— 强烈推荐
* **功能定位**：提供该概念的电梯演讲（Elevator Pitch），同时作为搜索结果摘要和上级目录页的预览文本。
* **写作公式**：**核心定义（是什么） + 适用场景/核心价值（有什么用）**。
  * *正例*：基于角色的访问控制（RBAC）是一种通过将权限绑定到角色而非单个用户来管理资源访问的安全模型，适用于多团队协作下的精细化权限隔离。
  * *反例*：本主题将向您介绍 RBAC 的相关概念。（空洞无物）

### 4.3 正文容器（`<conbody>`）与分段（`<section>`）
* **结构顺序要求**：在 `<conbody>` 中，一旦开始使用 `<section>` 或 `<example>`，**严禁在其后方再穿插游离的顶级 `<p>` 或 `<ul>`**。这不是风格建议：`concept.mod` 声明的模型就是 `((body.cnt)*, (section | example | conbodydiv)*)`，游离段落会**直接导致 DTA-OT/DTD 校验失败**（`The content of element type "conbody" must match …`）。所有后续内容都必须归属到具体的 `<section>` 内。
  * 注意区别：`<topic>` 的 `<body>` 是无序模型 `(body.cnt | bodydiv | example | section)*`，同样的写法在普通 topic 中合法，本条规则只约束 Concept 的 `<conbody>`。
  * 本编辑器同样按此模型实时提示（源码 lint、可视化波浪/底色标注与 Problems 面板），并把“在分节后面插入段落”的插入动作自动前移到分节之前。
* **禁止嵌套**：`<section>` 是平级的逻辑分节元素，**DITA 规范严禁在 `<section>` 内部再嵌套 `<section>`，也不允许在 `<section>` 内嵌 `<example>`**（`section.content` 只含 `basic.block`/`basic.ph` 与 `sectiondiv`）。如果某个概念复杂到需要多级子标题，应将其拆分为多个独立的 Concept 主题，并在 DITA Map 中通过层级关系组织。
* **分组需求**：需要把若干分节/示例归为一组时用 `<conbodydiv>`（`conbodydiv = (section | example)*`）；需要把某个分节内的段落/列表分组时用 `<sectiondiv>`（可嵌套）。
* **标题规范**：Concept 中的 `<section>` 强烈建议添加 `<title>`，且 `<section>` 的 `<title>` 同样应采用名词短语。

### 4.4 定义列表（`<dl>`）与架构图（`<fig>`）
* **定义列表（`<dl>`）**：当需要解释一组术语、组件角色、状态枚举或核心概念维度时，优先使用 `<dl>`（包含 `<dlentry>`、`<dt>`、`<dd>`），比普通无序列表（`<ul>`）具有更强的语义检索价值。
* **图表容器（`<fig>`）**：
  * 所有架构图、流程图、原理图必须包裹在 `<fig>` 标签中，而非直接插入裸露的 `<image>`。
  * 必须为 `<fig>` 提供简洁的名词性 `<title>`（如“OAuth 2.0 授权码模式时序图”），并在 `<image>` 内填写 `<alt>` 文本以满足无障碍访问（Accessibility）标准。

### 4.5 概念示例（`<example>`）
* 用于展示该概念在真实业务中的具体表现（如权限策略 JSON 结构示例、典型拓扑部署形态等）。
* **注意**：Concept 中的 `<example>` 重在**展示结果形态或场景案例**，而非教用户一步步敲命令操作。

---

## 5. 行内语义标签规范

在 Concept 主题中解释技术原理时，应准确使用以下语义标签：

| 语义类别 | DITA 标签 | 使用场景 | 编写示例 |
| :--- | :--- | :--- | :--- |
| **首次引入的术语** | `<term>` | 文中首次出现并加以定义的专有技术术语 | 系统采用<term>最终一致性</term>模型同步副本数据。 |
| **系统组件/API 名** | `<apiname>` | 类名、接口名、SDK 模块名称 | 网关通过调用 <apiname>AuthValidator</apiname> 校验令牌。 |
| **代码片段/表达式** | `<codeph>` | 行内简短的代码标识符、状态值、协议字段 | 当请求头包含 <codeph>X-Request-ID</codeph> 时…… |
| **引用文献/标准** | `<cite>` | 外部 RFC 标准、白皮书、行业规范名称 | 该协议遵循 <cite>RFC 6749</cite> 规范定义。 |
| **重点强调** | `<b>` / `<i>` | 仅用于极少数关键结论的语义强调（避免滥用） | 异步复制模式下，备节点数据存在<i>毫秒级延迟</i>。 |

> **注意**：DITA 1.3 基础词汇表中**没有 `<em>`**（那是 HTML 标签），语义强调请用 `<i>`（斜体）或 `<b>`（粗体）；`<q>`/`<term>`/`<cite>` 各有专门语义。

---

## 6. 内容复用（Reuse）规范

1. **术语库集中维护（Glossary / Terminology Reuse）**：核心产品术语定义统一维护在 `glossary_terms.dita` 或专用的 `concept_terminology.dita` 中，其他主题通过 `conkeyref` 引用 `<dlentry>` 或 `<ph>`，确保全书定义口径一致。
2. **通用架构声明复用**：如跨多个产品模块共享的安全合规声明、部署模式说明，封装为带 `id` 的 `<section>` 进行复用。
3. **产品变量引用**：产品名、版本代号统一使用 `<ph keyref="prod_name"/>`。

---

## 7. 常见反模式与自检清单

### 7.1 常见编写反模式（Anti-Patterns）

| 反模式现象 | 问题诊断 | 修正方案 |
| :--- | :--- | :--- |
| 在 Concept 中使用有序列表 `<ol>` 写“1. 登录控制台；2. 点击创建；3. 输入名称……” | 信息类型混杂（将 Task 写入了 Concept）。 | 删除操作步骤，将操作指南剥离为独立的 Task 主题，并在 Concept 中通过 `<xref>` 链接过去。 |
| 标题写成“如何理解权限模型”或“配置权限模型” | 标题句式不符合 Concept 规范（祈使句属于 Task）。 | 修改为名词短语：“权限模型概述”或“访问控制权限模型”。 |
| `<conbody>` 开头写了一段话，中间插了一个 `<section>`，末尾又直接写了一段无标题的 `<p>` | 末尾游离的 `<p>` 在视觉和逻辑上会被误认为属于上一个 `<section>`。 | 为末尾内容补充独立的 `<section><title>...</title><p>...</p></section>`（或把游离段落移到第一个 `<section>` 之前）。 |
| 单个 Concept 文件长达 3000 字，包含 10 个 `<section>` | 主题粒度过大，用户难以快速定位信息，不利于复用。 | 按核心子概念拆分为 3~4 个独立的 Concept 主题，通过 DITA Map 组织父子层级。 |

### 7.2 发布前自检清单（QA Checklist）

- [ ] 文件名与根元素 `id` 是否全小写、以 `concept_` 开头且完全一致？
- [ ] `<title>` 是否为名词短语（非祈使句、非疑问句）？
- [ ] `<shortdesc>` 是否清晰回答了“是什么”以及“核心价值/适用场景”？
- [ ] 全文是否保持客观陈述语态，未混入分步操作指令（`<ol>` 步骤）？
- [ ] `<conbody>` 是否满足“先基础块、后 `section`/`example`/`conbodydiv`”的顺序，`<section>` 之后未出现游离的顶级段落？
- [ ] `<section>` 是否均无多层嵌套，且内部未嵌 `<example>`（需要分组时用 `<sectiondiv>` / `<conbodydiv>`）？
- [ ] 架构图/流程图是否均已包裹在带 `<title>` 的 `<fig>` 中，且包含 `<alt>` 描述？
- [ ] 是否通过了 DITA-OT 或编辑器的 DTD/Schema 有效性校验？