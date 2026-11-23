# DITA Task（任务）主题编写规范

## 1. 概述与基本原则

### 1.1 适用范围
本规范适用于基于 DITA（Darwin Information Typing Architecture）标准编写的所有操作指导类技术文档（Task Topic）。Task 主题旨在回答用户**“如何完成某项具体操作（How-to）”**，具有强烈的行动导向与步骤化特征。

### 1.2 核心编写原则
1. **单一主题原则（One Task per Topic）**：每个 `.dita` 文件只描述一个独立、完整的用户操作目标。严禁将“创建配置”、“修改配置”和“删除配置”合并在同一个 Task 主题中。
2. **信息类型纯粹性（Strict Information Typing）**：
   * 仅保留完成操作所需的最小必要背景信息。
   * 大段架构原理、名词定义 $\rightarrow$ 拆分为 **Concept（概念）** 主题。
   * 详尽的参数列表、API 字段说明、错误码大全 $\rightarrow$ 拆分为 **Reference（参考）** 主题，在 Task 中通过 `<xref>` 引用。
3. **默认采用 Strict Task 模型**：新建原生 DITA 任务主题时，统一使用 `Strict Task` DTD（`task.dtd`），以强制保障内容结构的逻辑顺序；仅在迁移历史非结构化文档时允许使用 `General Task`。

---

## 2. 文件命名与 ID 规范

| 规范项 | 命名规则 | 正例 | 反例 |
| :--- | :--- | :--- | :--- |
| **文件名** | 全小写英文 + 下划线分隔，以 `task_` 开头，反映核心动作与对象 | `task_configure_ssl.dita`<br>`task_create_api_key.dita` | `SSL配置.dita`<br>`ConfigureSSL.dita`<br>`ssl_guide.dita` |
| **根元素 `id`** | 与文件名保持一致（不含扩展名），确保全局唯一 | `<task id="task_configure_ssl">` | `<task id="t1">`<br>`<task id="task_001">` |
| **内部元素 `id`** | 仅在需要被 `conref` 复用或交叉引用时添加，采用 `类型缩写_语义` | `<step id="step_verify_token">`<br>`<prereq id="prereq_admin_role">` | `<step id="s1">` |

---

## 3. 标准标签层级结构

`task.dtd` 是**带 Strict Taskbody 约束**的 Task 外壳（内部引用 `strictTaskbodyConstraint.mod`），因此 `task` 与 `taskbody` 的实际内容模型为：

```
task      : (title, titlealts?, (abstract | shortdesc)?, prolog?,
             taskbody?, related-links?, task*)
taskbody  : (prereq?, context?, (steps | steps-unordered)?,
             result?, tasktroubleshooting?, example?, postreq?)
```

由此得到三条硬结论：

1. **每个可选子元素最多出现一次**——包括 `<prereq>`、`<context>`、`<example>`、`<postreq>`；同一内容要分条表达时，写在元素内部用 `<ul>` / `<p>` 承载，而不是重复容器。
2. **顺序固定、不可交替**——例如 `<context>` 不能写在 `<prereq>` 之前。
3. **`<section>` 与 `<steps-informal>` 不在 Strict Task 的内容模型中**（它们只属于非约束的 `generalTask.dtd` / `ditabase.dtd`）；`<abstract>` 与 `<shortdesc>` 互斥；`<taskbody>` 可选。

> 若确有多个前置条件分组或多段示例，请改用 `<prereq>` 内部的 `<p>` / `<ul>`，或拆分为独立 Task；不要为了"分组"而引入 `<section>`——本规范统一使用 Strict Task。

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE task PUBLIC "-//OASIS//DTD DITA Task//EN" "task.dtd">
<task id="task_action_object" xml:lang="zh-CN">
  <title>动宾结构的任务标题</title>
  <!-- 可选：目录/导航用的备用标题 -->
  <titlealts><navtitle>目录中显示的短标题</navtitle></titlealts>

  <!-- 二选一：<shortdesc> 或 <abstract>（<abstract> 可容纳多个块，二者不可同时出现） -->
  <shortdesc>简明扼要地说明任务目的与适用场景（1~2 句话）。</shortdesc>

  <prolog>
    <!-- 可选：元数据、关键词、受众角色等 -->
  </prolog>

  <taskbody>
    <prereq>前置条件：执行操作前必须满足的环境、权限或依赖要求。</prereq>
    <context>背景说明：补充操作限制、执行频率或全局注意事项。</context>
    
    <!-- 核心步骤区（三选一）：steps / steps-unordered / steps-informal -->
    <steps>
      <step>
        <!-- note 只能出现在 cmd 之前 -->
        <note type="important">步骤级提示：仅在必要时使用，且必须写在操作指令之前。</note>
        <cmd>核心操作指令（必填，祈使句，且每步只能有一个）。</cmd>
        <info>补充说明、参数解释、界面截图或注意事项。</info>
        <substeps>
          <substep>
            <cmd>子步骤指令（仅允许单层嵌套）。</cmd>
          </substep>
        </substeps>
        <!-- choices / choicetable / info / itemgroup / stepxmp / substeps / tutorialinfo
             同属一个可重复分组；substep 内则不允许 choices 与 choicetable -->
        <choices>
          <choice>操作分支选项 A</choice>
          <choice>操作分支选项 B</choice>
        </choices>
        <itemgroup>
          <p>同一事项的多段补充说明，与相邻的补充信息并列。</p>
        </itemgroup>
        <stepxmp>该步骤的具体输入示例。</stepxmp>
        <tutorialinfo>
          <p>教学提示：解释该步骤背后的原理或技巧。</p>
        </tutorialinfo>
        <stepresult>执行完当前步骤后系统的即时反馈（最多一个，且位于所有补充信息之后）。</stepresult>
        <steptroubleshooting>
          <p>本步骤未达预期时的排查建议。</p>
        </steptroubleshooting>
      </step>
    </steps>

    <result>最终结果：所有步骤完成后系统达到的预期状态。</result>
    <tasktroubleshooting>故障排查：结果未达预期时的常见修复方案。</tasktroubleshooting>
    <example>完整端到端操作示例。</example>
    <postreq>后续操作：完成本任务后建议执行的下一步操作。</postreq>
  </taskbody>

  <related-links>
    <link href="task_next_step.dita"><linktext>相关任务</linktext></link>
  </related-links>
</task>
```

> **关于 `<taskbody>` 的说明**：在 DITA 1.3 `task.dtd` 中 `<taskbody>` 是**可选**元素（`(taskbody)?`），这不是本规范的额外限制。当某 Task 在 DITA Map 中仅作为**父级目录容器（Container Topic）**汇总子任务时，可只保留 `<title>` 与 `<shortdesc>`（或 `<abstract>`），省略 `<taskbody>`。
>
> 但请注意：`<task>` 的内容模型里没有 `<body>`，一旦省略 `<taskbody>`，主题内就**没有任何合法的正文挂载点**。因此**叶子任务必须包含 `<taskbody>`**。本合集所用的编辑器据此禁止删除 `<taskbody>`——这是**编辑策略限制**（提示语为“编辑需要保留 `<taskbody>` 作为内容挂载点”），而非 DTD 语法要求；若手工编写 XML，省略 `<taskbody>` 依然能通过 DTD 校验。
>
> 另：`task.content` 末尾的 `task*` 允许挂载**嵌套子主题**（在 Strict Task 外壳里只能是 `<task>`，不能内嵌 `<concept>`），建议不超过一层；`<related-links>` 位于 `<taskbody>` 之后、嵌套主题之前。

---

## 4. 核心元素写作细则

### 4.1 标题（`<title>`）— 必填
* **句式要求**：必须采用**动宾短语**，明确体现用户的操作动作与操作对象。
  * **中文规范**：以动词开头（如“配置自定义域名”、“重置管理员密码”）。避免使用“关于……”、“……指南”、“……的方法”等名词性短语。
  * **英文规范**：全书保持统一风格，推荐使用动名词（Gerund，如 *Configuring custom domains*）或动词原形（Imperative，如 *Configure custom domains*）。
* **长度控制**：建议控制在 15 个汉字（或 8 个英文单词）以内，避免包含标点符号。

### 4.2 简述（`<shortdesc>`）— 强烈推荐
* **功能定位**：用于帮助用户快速判断该文档是否符合需求；同时会被发布引擎提取为搜索结果摘要及父级目录页面的悬停预览。
* **写作公式**：**操作动作 + 业务目的/预期价值**。
  * *正例*：为项目配置 Webhook 回调地址，以便在代码仓库发生推送事件时自动触发持续集成流水线。
  * *反例*：本节介绍如何配置 Webhook。（无信息增量）
* **禁忌**：不要在 `<shortdesc>` 中直接罗列具体操作步骤或插入大段警告框。

### 4.3 前置条件（`<prereq>`）— 可选
* **内容边界**：仅列出开始第一步操作**之前**必须已经满足的硬性条件（如账号权限、前置软件版本、已获取的密钥）。
* **格式建议**：若存在 2 条及以上前置条件，必须使用无序列表（`<ul>`）分条列出；单条条件可使用 `<p>`。
* **注意事项**：属于操作过程中的判断条件（如“如果弹窗提示更新，请点击确认”），应写入对应 `<step>`，而非 `<prereq>`。

### 4.4 背景说明（`<context>`）— 可选
* **内容边界**：交代执行该任务的业务时机、执行频率、耗时预估或全局性风险提示。
* **篇幅控制**：严格控制在 **1~2 个简短段落**（不超过 150 字）。若背景解释超过 2 段，应将其抽离为独立的 Concept 主题。

### 4.5 步骤容器与步骤（`<steps>` / `<step>`）— 核心
1. **容器选择**：
   * `<steps>`：默认使用，步骤存在严格的先后依赖关系（渲染为有序列表 `1, 2, 3...`）。
   * `<steps-unordered>`：仅当多个动作之间完全没有先后顺序要求时使用（渲染为项目符号列表）。
   * `<steps-informal>`：**没有 `<cmd>`** 的叙述式流程，仅存在于非约束模型（`generalTask.dtd` / `ditabase.dtd`）。**本规范的 Strict Task（`task.dtd`）不支持它**，需要"流程说明"时请改用 `<context>` 或 `<steps>` 前的 `<p>`。
2. **步骤数量控制**：
   * 单个 Task 主题的步骤数建议控制在 **3~9 步**。
   * 若超过 10 步，优先考虑按业务阶段拆分为多个独立的 Task 主题；若无法拆分，可使用 `<stepsection>` 将长步骤分组（不重置编号）。
3. **单一动作原则**：每个 `<step>` 只包含一个核心用户动作。禁止将两个独立界面的连续操作强行塞入同一个 `<cmd>` 中（除非属于同一菜单路径导航）。

### 4.6 操作指令（`<cmd>`）— `<step>` 内必填
* **唯一性**：每个 `<step>` 内**有且只能有一个 `<cmd>`**。
* **语态与句式**：必须使用**祈使句、主动语态、第二人称（省略主语“您”）**，直接以动作动词开头。
  * *正例*：在左侧导航栏中，选择<menucascade><uicontrol>系统管理</uicontrol><uicontrol>安全策略</uicontrol></menucascade>。
  * *反例*：用户需要在左侧导航栏中找到系统管理，然后点击安全策略进入配置页面。（冗长、第三人称、多动作混杂）
* **信息剥离**：`<cmd>` 只写“做什么”，解释“为什么这样做”或“参数含义”的内容必须放入紧随其后的 `<info>` 中。

### 4.7 步骤补充信息（`<info>`）、分支（`<choices>`）与子步骤（`<substeps>`）
* **`<info>`**：用于存放对 `<cmd>` 的补充解释、截图（`<fig>`）、代码块（`<codeblock>`）或注意事项（`<note>`）。严禁在 `<info>` 中隐藏新的必做操作步骤。
* **`<choices>` / `<choicetable>`**：
  * 当某一步骤存在 2~3 个简单的互斥操作选项时，使用 `<choices>`。
  * 当选项包含多个维度（如“选项名称”、“适用场景”、“操作方式”）时，使用结构化的 `<choicetable>`。
* **`<itemgroup>`**：当同一步骤需要多段彼此并列的补充说明（或与 `<info>` 混排）时使用，内部可放 `<p>`、`<ul>` 等块。
* **`<tutorialinfo>`**：用于"教学式"解释（为什么这样做、背后的原理），与 `<info>` 区分开，便于发布端按需隐藏。
* **`<substeps>`**：仅在某个主步骤内部包含多个细碎子动作时使用。**DITA 规范严禁 `<substeps>` 多层嵌套**（即 `<substep>` 内不能再出现 `<substeps>`），`<substep>` 内同样不允许 `<choices>` / `<choicetable>`（子步骤不能再分叉）。
* **顺序**：`<step>` 内 `<note>` 必须在 `<cmd>` **之前**；`info | itemgroup | stepxmp | substeps | choices | choicetable | tutorialinfo` 可重复且可任意排序；`<stepresult>`、`<steptroubleshooting>` 必须分别位于 `<cmd>` 之后的最后两个位置。

### 4.8 步骤结果（`<stepresult>`）与最终结果（`<result>`）
* **`<stepresult>`**：位于 `<step>` 内部，**最多一个**，且必须排在所有补充信息之后、`<steptroubleshooting>` 之前。**无需每一步都写**，仅当某一步骤会触发显著的界面跳转、后台异步任务或需要用户核对中间状态时添加。
* **`<result>`**：位于 `<steps>` 之后。用于描述整个任务全部执行完毕后，系统达到的最终状态或交付产物。

### 4.9 故障排查（`<tasktroubleshooting>`）与后续操作（`<postreq>`）
* **`<tasktroubleshooting>`**（**最多一个**，位于 `<result>` 之后、`<example>` 之前）：列出用户执行完步骤后，若 `<result>` 未达预期时的常见排查与修复手段（如“若状态显示为异常，请检查防火墙 443 端口是否放行”）。
* **`<steptroubleshooting>`**：单步级别的排障建议，位于 `<step>` 最末；任务级的共性问题仍应写在 `<tasktroubleshooting>`。
* **`<postreq>`**：引导用户进入下一个逻辑关联的 Task 主题，通常配合 `<xref>` 交叉引用使用。

---

## 5. 行内语义标签（Inline Elements）规范

编写 `<cmd>`、`<info>` 等文本时，必须使用语义化行内标签标记界面与代码元素，**禁止直接使用纯视觉加粗（`<b>`）或斜体（`<i>`）替代**。

| 语义类别 | DITA 标签 | 使用场景 | 编写示例 |
| :--- | :--- | :--- | :--- |
| **界面控件** | `<uicontrol>` | 按钮、菜单项、选项卡、复选框、输入框标签 | 点击<uicontrol>保存并应用</uicontrol>。 |
| **窗口/页面标题** | `<wintitle>` | 对话框标题、面板名称、控制台页面名称 | 在<wintitle>网络配置</wintitle>页面中…… |
| **菜单级联路径** | `<menucascade>` | 连续点击 2 级及以上的菜单导航 | 选择<menucascade><uicontrol>文件</uicontrol><uicontrol>导出</uicontrol><uicontrol>PDF</uicontrol></menucascade>。 |
| **命令名称** | `<cmdname>` | CLI 工具名、Shell 命令名称 | 运行 <cmdname>kubectl</cmdname> 命令查看状态。 |
| **参数/变量名** | `<parmname>` | 命令行参数、API 参数、配置文件键名 | 将 <parmname>timeout</parmname> 设置为 <userinput>30</userinput>。 |
| **用户输入** | `<userinput>` | 需要用户原样输入的文本、命令或值 | 在终端中输入 <userinput>sudo systemctl restart nginx</userinput>。 |
| **系统输出** | `<systemoutput>` | 终端返回信息、系统状态值、日志输出 | 控制台返回 <systemoutput>Active: active (running)</systemoutput>。 |
| **文件路径/名** | `<filepath>` | 目录路径、文件名 | 打开配置文件 <filepath>/etc/nginx/nginx.conf</filepath>。 |

### 注意事项标签（`<note>`）使用规范
`<note>` 应放置在 `<context>`、`<section>`、`<info>`、`<result>` 中，或放在 `<step>` 内所有 `<cmd>` **之前**，并明确指定 `type` 属性：
* `<note type="note">`：一般性补充说明（默认）。
* `<note type="tip">`：提高操作效率的技巧或最佳实践。
* `<note type="important">`：不遵循会导致功能异常的关键前提。
* `<note type="caution">` / `<note type="warning">`：可能导致数据丢失、服务中断或安全风险的操作警示（**必须放在操作步骤之前或对应步骤的 `<info>` 顶部**）。

### 标准危险警示（`<hazardstatement>`）
当文档涉及人身安全风险时，除 `<note type="warning">` 外，应优先使用标准化危险警示元素，便于发布端统一渲染与合规检索：

```xml
<hazardstatement type="warning">
  <messagepanel>
    <typeofhazard>电击</typeofhazard>
    <consequence>接触高压端子可能导致严重伤害。</consequence>
    <howtoavoid>断开总电源并等待指示灯熄灭后再操作。</howtoavoid>
  </messagepanel>
</hazardstatement>
```

* `type` 取 `danger` / `warning` / `caution` / `notice` 等标准值；`<howtoavoid>` 至少一条。
* `<howtoavoid>` 的内容模型是**行内内容**（`#PCDATA` + `ph`/`tm` 等 + `sl`/`simpletable`），**不能放 `<p>` / `<ul>`**；需要列表时用 `<sl>`。
* `<hazardstatement>` 可放在 `<prereq>`、`<context>`、`<section>`、`<steps-informal>` 等正文容器中，或放在 `<step>` 内 `<cmd>` **之前**（与 `<note>` 同一位置）。

---

## 6. 内容复用（Reuse）规范

1. **通用前置条件复用**：多个任务共享相同的登录或权限要求时，统一维护在仓库的 `reuse_prereqs.dita` 中，通过 `conkeyref` 引用：
   ```xml
   <prereq conkeyref="reuse_prereqs/prereq_console_login"/>
   ```
2. **高频操作步骤复用**：如“保存配置并重启服务”等标准化操作步骤，封装为独立 `<step>` 并赋予语义化 `id`，供其他 Task 主题复用。
3. **产品名称与变量**：严禁在正文中硬编码产品名称或版本号，统一使用 `<ph keyref="prod_name"/>` 引用。

---

## 7. 常见反模式与自检清单

### 7.1 常见编写反模式（Anti-Patterns）

| 反模式现象 | 问题诊断 | 修正方案 |
| :--- | :--- | :--- |
| `<cmd>` 写成：“点击**确定**，然后系统会弹出确认框，在确认框中输入密码。” | 单步包含多个动作，且混杂了系统反馈。 | 拆分为两个 `<step>`；系统弹窗放入第一步的 `<stepresult>`。 |
| 在 `<context>` 中写了 500 字的 OAuth 2.0 协议原理。 | 信息类型污染（Concept 混入 Task）。 | 精简 `<context>` 至 50 字以内，原理内容迁移至独立 Concept 主题并添加 `<xref>`。 |
| 一个 Task 包含 18 个步骤，涵盖从安装到卸载的全生命周期。 | 违反单一主题原则，粒度过大，难以维护和复用。 | 按子目标拆分为“安装……”、“配置……”、“卸载……” 3 个独立 Task 主题。 |
| 使用 `<step>` 列出 5 个不需要按顺序执行的检查项。 | 误用有序步骤容器。 | 改用 `<steps-unordered>`，或移入 `<prereq>` 的无序列表中。 |

### 7.2 发布前自检清单（QA Checklist）

- [ ] 文件名与根元素 `id` 是否全小写、以 `task_` 开头且完全一致？
- [ ] `<title>` 是否为清晰的动宾结构？
- [ ] `<shortdesc>` 是否概括了“做什么”与“为什么做”，且未包含具体步骤？
- [ ] 每个 `<step>` 是否只包含一个 `<cmd>`，且以祈使句动作动词开头？
- [ ] `<steps>` / `<steps-unordered>` / `<steps-informal>` 是否只出现一种，`<result>` 与 `<tasktroubleshooting>` 是否各不超过一个？
- [ ] `<stepresult>` 是否排在补充信息之后，且 `<substep>` 内没有 `<substeps>` / `<choices>` / `<choicetable>`？
- [ ] 单个 Task 的步骤数量是否控制在 3~9 步的合理区间？
- [ ] 界面控件、命令、路径是否均已使用正确的行内语义标签包裹？
- [ ] 所有可能导致数据丢失的 `<note type="warning">` 是否放置在用户执行危险动作之前？
- [ ] 是否通过了 DITA-OT 或编辑器的 DTD/Schema 有效性校验（无结构报错与死链）？