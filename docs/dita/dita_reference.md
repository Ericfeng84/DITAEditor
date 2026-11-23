# DITA Reference（参考）主题编写规范

## 1. 概述与基本原则

### 1.1 适用范围
本规范适用于基于 DITA（Darwin Information Typing Architecture）标准编写的所有事实查询、规格参数与语法定义类技术文档（Reference Topic），包括但不限于：CLI 命令行参考、RESTful API 接口说明、SDK 方法定义、配置文件参数表、系统限制与配额、错误码大全。Reference 主题旨在回答用户**“有哪些具体参数/选项/语法（What are the specs）”**。

### 1.2 核心编写原则
1. **高可扫描性（High Scannability）**：用户查阅 Reference 文档的目的是**快速检索精确事实**，而非从头到尾通读。必须优先使用表格（`<properties>` / `<table>`）、语法块（`<refsyn>`）和代码块（`<codeblock>`）组织内容，最大限度减少大段叙述性散文。
2. **高度结构化与一致性（Consistency）**：同类参考主题（如同一组 CLI 命令或同一模块的 20 个 API 接口）必须采用完全一致的 `<section>` 顺序、表格列头和命名约定。
3. **信息类型纯粹性（Strict Information Typing）**：
   * 仅陈述客观规格、默认值、取值范围、数据类型与语法格式。
   * 端到端业务操作教程 $\rightarrow$ 拆分为 **Task（任务）** 主题。
   * 底层设计原理与架构背景 $\rightarrow$ 拆分为 **Concept（概念）** 主题。

---

## 2. 文件命名与 ID 规范

| 规范项 | 命名规则 | 正例 | 反例 |
| :--- | :--- | :--- | :--- |
| **文件名** | 全小写英文 + 下划线分隔，以 `reference_` 开头，反映具体命令/接口/配置对象 | `reference_cli_deploy.dita`<br>`reference_config_yaml.dita`<br>`reference_error_codes.dita` | `命令参考.dita`<br>`DeployCLI.dita`<br>`ref1.dita` |
| **根元素 `id`** | 与文件名保持一致（不含扩展名），确保全局唯一 | `<reference id="reference_cli_deploy">` | `<reference id="r1">`<br>`<reference id="ref_001">` |
| **内部元素 `id`** | 仅在需要被 `conref` 复用或交叉引用时添加，采用 `类型缩写_语义` | `<section id="sec_syntax">`<br>`<property id="prop_timeout">` | `<table id="t1">` |

---

## 3. 标准标签层级结构

**关键语法约束（高频易错点）**：在标准 DITA DTD 中，`<refbody>` **不允许直接包含裸露的 `<p>`、`<ul>`、`<ol>` 或 `<codeblock>`**（`reference.body.cnt` 不含基本块）。`<refbody>` 的直接子元素只能是以下结构化容器：`<section>`、`<refsyn>`、`<properties>`、`<table>`、`<simpletable>`、`<example>`、`<refbodydiv>` 以及复用用的 `<data>` / 未知扩展元素。

```text
reference  = (title, titlealts?, (abstract|shortdesc)?, prolog?, refbody?, related-links?, reference*)
refbody    = (refsyn | properties | section | example | simpletable | table | refbodydiv)*   // 无序
refbodydiv = 同 refbody（可自嵌套）
refsyn    = (section.cnt)*          // title + 基本块/短语，不能放 section / example / properties
properties = (prophead?, property+) // 至少一行 property！
property   = (proptype?, propvalue?, propdesc?)
prophead   = (proptypehd?, propvaluehd?, propdeschd?)
```

还有两条常被写错的强约束：

1. **`<properties>` 只能直接挂在 `<refbody>` 或 `<refbodydiv>` 下**，不能塞进 `<section>`（`section.cnt` 不含 `properties`），DTD 校验会直接报错。
2. **`<properties>` 没有 `<title>`**（它只有 `keycol` / `relcolwidth` / `refcols` 属性）。需要标题时，要么改用 `<section><title>…</title><table>`（多列复杂规格），要么把 `<properties>` 放在 `<refbody>` 级、由 `<shortdesc>` 与相邻分节标题共同定位信息。
3. `<section>` 里同样不能放 `<example>`（示例做成 `<refbody>` 级的 `<example>`，或用 `<refbodydiv>` 成组）；`<section>` 内要分组请用 `<sectiondiv>`。
4. **`<refbody>` 本身可选**（`refbody?`），但只要有正文就必须使用它；`<reference>` 可以嵌套子 `<reference>`（`reference*`），却不能嵌套 `<concept>` / `<task>`。


```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE reference PUBLIC "-//OASIS//DTD DITA Reference//EN" "reference.dtd">
<reference id="reference_cli_deploy" xml:lang="zh-CN">
  <title><cmdname>sysctl deploy</cmdname> 命令参考</title>
  <shortdesc>将本地构建的应用镜像部署至指定环境集群，并支持灰度发布策略配置。</shortdesc>
  
  <prolog>
    <!-- 可选：元数据、适用版本、关键词等 -->
  </prolog>

  <refbody>
    <!-- 1. 语法定义区：专用元素 <refsyn> -->
    <refsyn>
      <title>语法</title>
      <codeblock outputclass="language-bash">sysctl deploy &lt;app-name&gt; --env &lt;environment&gt; [options]</codeblock>
    </refsyn>

    <!-- 2. 参数/选项规格区：<properties> 直接挂在 <refbody> 下（它不能放在 <section> 里，也没有 title） -->
    <properties keycol="3">
      <prophead>
        <proptypehd>参数/选项</proptypehd>
        <propvaluehd>类型与默认值</propvaluehd>
        <propdeschd>说明</propdeschd>
      </prophead>
      <property>
        <proptype><parmname>--env</parmname>, <parmname>-e</parmname></proptype>
        <propvalue>String（必填）</propvalue>
        <propdesc>目标部署环境名称。可选值：<codeph>dev</codeph>、<codeph>staging</codeph>、<codeph>prod</codeph>。</propdesc>
      </property>
      <property>
        <proptype><parmname>--replicas</parmname></proptype>
        <propvalue>Integer（默认：<codeph>2</codeph>）</propvalue>
        <propdesc>初始启动的实例副本数量，取值范围为 <codeph>1</codeph> 至 <codeph>50</codeph>。</propdesc>
      </property>
    </properties>

    <!-- 3. 返回值/状态码区 -->
    <section id="sec_exit_codes">
      <title>退出状态码</title>
      <simpletable>
        <sthead>
          <stentry>状态码</stentry>
          <stentry>含义</stentry>
        </sthead>
        <strow>
          <stentry><systemoutput>0</systemoutput></stentry>
          <stentry>部署成功且所有实例均通过健康检查。</stentry>
        </strow>
        <strow>
          <stentry><systemoutput>1</systemoutput></stentry>
          <stentry>参数校验失败或目标环境不可达。</stentry>
        </strow>
      </simpletable>
    </section>

    <!-- 4. 调用示例区 -->
    <example>
      <title>示例：向生产环境部署 5 个副本</title>
      <codeblock outputclass="language-bash">sysctl deploy payment-service --env prod --replicas 5</codeblock>
    </example>
  </refbody>
</reference>
```

---

## 4. 核心元素写作细则

### 4.1 标题（`<title>`）— 必填
* **句式要求**：必须采用**名词短语**，清晰标识所记录的技术实体名称（命令名、API 路径、配置文件名或资源类别）。
  * *正例*：“`POST /v1/users` 接口参考”、“`config.yaml` 配置参数说明”、“系统错误码列表”。
  * *反例*：“如何使用 `POST /v1/users` 接口”（应归入 Task 主题）。

### 4.2 简述（`<shortdesc>`）— 强烈推荐
* **功能定位**：概括该命令、接口或配置文件的核心用途与适用范围。
* **写作公式**：**对象功能定义 + 关键约束或返回结果**。
  * *正例*：创建一个新的项目工作区，并返回包含工作区唯一标识符（`workspace_id`）及访问令牌的 JSON 对象。
  * *反例*：本页列出了创建工作区接口的所有参数。（无有效信息）

### 4.3 语法定义块（`<refsyn>`）
* **专用场景**：专门用于呈现 CLI 命令语法签名、API 请求行（HTTP Method + Endpoint）、SQL 语句结构或函数原型。
* **格式约定**（全团队统一）：
  * 尖括号 `<param>` 表示必填占位符；
  * 方括号 `[--flag]` 表示可选项；
  * 竖线 `a | b` 表示互斥选项；
  * 省略号 `...` 表示可重复参数。
* **边界**：`<refsyn>` 内部只允许 `<title>` 与基本块（`<codeblock>`、`<p>`、`<ul>`…），**不能**放 `<example>`、`<properties>`、`<section>`；这些都要提到 `<refbody>` 级。

### 4.4 规格表格选型（`<properties>` vs `<table>` vs `<simpletable>`）
在 Reference 主题中，应根据数据维度合理选择表格元素：

| 表格标签 | 适用场景 | 结构特点与优势 |
| :--- | :--- | :--- |
| **`<properties>`** | 标准的“名称 - 类型/值 - 描述”三元规格（如 CLI 选项、环境变量、简单的配置项） | DITA 专属语义标签，包含 `<proptype>`、`<propvalue>`、`<propdesc>`，语义最精准，便于自动化抽取元数据。**硬约束：至少包含 1 个 `<property>`；不携带 `<title>`；只能直接放在 `<refbody>` / `<refbodydiv>` 下**。 |
| **`<table>`** | 多维度复杂规格（如 REST API 参数表需同时展示：参数名、位置、类型、是否必填、默认值、说明，共 5~6 列） | 完整支持 CALS 表格模型，支持单元格合并（`namest`/`nameend`/`morerows`）、表标题（`<title>`）及复杂列宽控制。 |
| **`<simpletable>`** | 轻量级双列或三列对照表（如错误码对照表、快捷键列表） | 语法简洁，渲染开销小，不支持单元格合并。 |

* **参数描述写作规范（`<propdesc>` / `<entry>`）**：
  * 必须明确说明**是否必填**、**默认值**、**合法取值范围/枚举值**以及**约束限制**。
  * 统一使用陈述短语，避免冗余的“该参数用于设置……”等套话（直接写“设置初始启动的实例副本数量……”）。

### 4.5 代码示例（`<example>` 与 `<codeblock>`）
* 每个 API 或 CLI Reference 主题应至少包含 1 个可直接复制运行的 `<example>`。
* `<codeblock>` 必须标注语言类型（如 `outputclass="language-json"` 或 `outputclass="language-bash"`），以便发布引擎正确渲染语法高亮。
* 对于 API 接口，`<example>` 中应同时提供**请求示例（Request）**与**成功响应示例（Response）**，并确保 JSON/XML 格式合法、缩进规范（统一 2 空格或 4 空格）。

---

## 5. 行内语义标签规范

Reference 主题对行内代码的语义区分要求最为严格，禁止混用标签或仅使用纯文本加粗：

| 语义类别 | DITA 标签 | 使用场景 | 编写示例 |
| :--- | :--- | :--- | :--- |
| **CLI 命令名** | `<cmdname>` | 可执行程序名、子命令名 | 执行 <cmdname>docker compose</cmdname> 启动容器。 |
| **参数/键名** | `<parmname>` | 命令行选项、API 字段名、配置项键名 | 设置 <parmname>max_retries</parmname> 参数。 |
| **API/函数名** | `<apiname>` | SDK 函数名、类方法名、Webhook 事件名 | 调用 <apiname>createSession()</apiname> 方法。 |
| **变量占位符** | `<varname>` | 需要用户替换为实际值的变量名 | 替换 <varname>YOUR_API_KEY</varname> 为真实密钥。 |
| **行内代码/字面量** | `<codeph>` | 枚举值、数据类型、布尔值、HTTP 状态码 | 支持 <codeph>true</codeph> 或 <codeph>false</codeph>，成功返回 <codeph>200</codeph>。 |
| **系统输出/错误码** | `<systemoutput>` / `<msgnum>` | 终端返回字符串、特定错误编号 | 触发错误码 <msgnum>ERR_4012</msgnum> 时返回 <systemoutput>TokenExpired</systemoutput>。 |
| **文件路径** | `<filepath>` | 配置文件路径、日志目录 | 默认读取 <filepath>~/.config/app/settings.json</filepath>。 |

---

## 6. 内容复用（Reuse）规范

1. **公共请求头与通用参数复用**：如所有 REST API 共享的 `Authorization`、`X-Request-ID` 请求头或分页参数（`page`、`page_size`），统一维护在 `reuse_api_common.dita` 的 `<tgroup>` 或 `<row>` 中，通过 `conkeyref` 嵌入各 API 表格，避免重复维护。
2. **全局错误码复用**：各接口特有的业务错误码维护在各自主题中，通用 HTTP 状态码通过 `<xref>` 链接至全局 `reference_error_codes.dita`。
3. **版本与端点变量**：API Base URL 或版本前缀使用 `<ph keyref="api_base_url"/>` 引用，确保多环境发布时自动替换。

---

## 7. 常见反模式与自检清单

### 7.1 常见编写反模式（Anti-Patterns）

| 反模式现象 | 问题诊断 | 修正方案 |
| :--- | :--- | :--- |
| 直接在 `<refbody>` 下写 `<p>以下是参数说明：</p>` | **违反 DITA DTD 语法约束**，导致构建直接报错。 | 将 `<p>` 移入 `<section>` 内部，或直接以 `<section><title>参数说明</title><table>...</table></section>` 组织。 |
| `<section><title>参数说明</title><properties>…</properties></section>` | **同样非法**：`section.cnt` 不含 `properties`（也不含 `refsyn`、`example`）。 | 把 `<properties>` 提到 `<refbody>` 级；需要标题则改用 `<section>` + `<table>`（CALS，支持 `<title>`）。 |
| 只有 `<prophead>` （表头）却没有 `<property>` 行 | `properties = (prophead?, property+)`，缺少 property 会校验失败。 | 至少保留一行 `<property>`（哪怕先写占位值）。 |
| 在 `<refsyn>` 里再包 `<example>` / `<properties>` | `refsyn.cnt` 只允许标题与基本块。 | 示例与参数表都提到 `<refbody>` 级，或用 `<refbodydiv>` 成组。 |
| 参数表中只写了参数名和一句模糊解释，未写类型、是否必填和默认值 | 无法满足开发者查阅精确规格的核心诉求，导致频繁咨询或调用报错。 | 补全数据类型、必填/选填标识、默认值及合法取值范围。 |
| 在 Reference 中用 5 个步骤教用户如何申请 API Key 并配置环境变量 | 信息类型混杂（将 Task 写入了 Reference）。 | 删除操作步骤，在 `<shortdesc>` 或 `<related-links>` 中添加指向 `task_generate_api_key.dita` 的链接。 |
| JSON 示例中包含 `// 注释` 或末尾多余逗号（非标准 JSON） | 用户复制示例后直接运行会触发语法解析错误。 | 确保所有代码示例均为语法完全合法、可直接执行的代码。 |

### 7.2 发布前自检清单（QA Checklist）

- [ ] 文件名与根元素 `id` 是否全小写、以 `reference_` 开头且完全一致？
- [ ] `<refbody>` 的所有直接子元素是否均为合法容器（`<section>`、`<refsyn>`、`<properties>`、`<table>`、`<simpletable>`、`<example>`），无裸露的 `<p>` 或 `<ul>`？
- [ ] 命令/接口语法是否已使用 `<refsyn>` 规范标注必填项 `<...>` 与可选项 `[...]`？
- [ ] 所有参数/字段是否均已明确标注**数据类型**、**是否必填**、**默认值**及**取值范围**？
- [ ] `<codeblock>` 是否均已标注正确的语法高亮语言属性（`outputclass`），且代码格式合法可运行？
- [ ] 参数名、命令名、枚举值、变量占位符是否已分别使用 `<parmname>`、`<cmdname>`、`<codeph>`、`<varname>` 正确标记？
- [ ] 同系列 Reference 主题的 `<section>` 顺序与表格列头是否保持完全一致？
- [ ] 是否通过了 DITA-OT 或编辑器的 DTD/Schema 有效性校验？