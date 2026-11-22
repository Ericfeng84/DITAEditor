/**
 * Standard DITA 1.3 topic templates and Phase 1 built-in showcase documents.
 */

export type DitaTopicTemplateType = 'concept' | 'task' | 'reference' | 'topic';

export interface CreateTopicTemplateOptions {
  id?: string;
  title?: string;
  shortdesc?: string;
  lang?: string;
}

export interface DitaSampleDocument {
  id: string;
  fileName: string;
  title: string;
  type: DitaTopicTemplateType;
  badge: string;
  description: string;
  xml: string;
}

function sanitizeId(raw: string, fallback: string): string {
  const cleaned = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (!cleaned) return fallback;
  return /^[a-z_]/.test(cleaned) ? cleaned : `id_${cleaned}`;
}

function escapeText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Generate a clean, OASIS-compliant DITA 1.3 topic template with deterministic indentation.
 */
export function createTopicTemplate(
  type: DitaTopicTemplateType,
  options: CreateTopicTemplateOptions = {},
): string {
  const lang = options.lang ?? 'zh-CN';
  const id = sanitizeId(options.id ?? `${type}_${Date.now().toString(36)}`, `${type}_untitled`);
  const english = /^en\b/i.test(lang);

  switch (type) {
    case 'concept': {
      if (english) {
        const title = escapeText(options.title ?? 'New Concept Topic');
        const shortdesc = escapeText(
          options.shortdesc ?? 'Summarize the core definition, background, and applicable scenarios of this concept.',
        );
        return [
          '<?xml version="1.0" encoding="UTF-8"?>',
          '<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">',
          `<concept id="${id}" xml:lang="${lang}">`,
          `  <title>${title}</title>`,
          `  <shortdesc>${shortdesc}</shortdesc>`,
          '  <conbody>',
          '    <p>Write the concept body here. Use <b>bold</b>, <codeph>inline code</codeph>, or insert sections and notes.</p>',
          '    <section id="sec_overview">',
          '      <title>Key Components</title>',
          '      <ul>',
          '        <li>Key capability one</li>',
          '        <li>Key capability two</li>',
          '      </ul>',
          '    </section>',
          '  </conbody>',
          '</concept>',
          '',
        ].join('\n');
      }
      const title = escapeText(options.title ?? '新建概念主题');
      const shortdesc = escapeText(
        options.shortdesc ?? '简要概括本概念的核心定义、背景原理与适用场景。',
      );
      return [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">',
        `<concept id="${id}" xml:lang="${lang}">`,
        `  <title>${title}</title>`,
        `  <shortdesc>${shortdesc}</shortdesc>`,
        '  <conbody>',
        '    <p>在此撰写概念说明正文，可使用 <b>粗体</b>、<codeph>行内代码</codeph> 或插入章节与提示框。</p>',
        '    <section id="sec_overview">',
        '      <title>核心组成</title>',
        '      <ul>',
        '        <li>关键特性一</li>',
        '        <li>关键特性二</li>',
        '      </ul>',
        '    </section>',
        '  </conbody>',
        '</concept>',
        '',
      ].join('\n');
    }

    case 'task': {
      if (english) {
        const title = escapeText(options.title ?? 'New Task Topic');
        const shortdesc = escapeText(
          options.shortdesc ?? 'Describe the goal of this procedure and the result it produces.',
        );
        return [
          '<?xml version="1.0" encoding="UTF-8"?>',
          '<!DOCTYPE task PUBLIC "-//OASIS//DTD DITA Task//EN" "task.dtd">',
          `<task id="${id}" xml:lang="${lang}">`,
          `  <title>${title}</title>`,
          `  <shortdesc>${shortdesc}</shortdesc>`,
          '  <taskbody>',
          '    <prereq>',
          '      <p>Make sure the required environment and permissions are in place.</p>',
          '    </prereq>',
          '    <context>',
          '      <p>Complete the configuration by following these steps:</p>',
          '    </context>',
          '    <steps>',
          '      <step>',
          '        <cmd>Run the first command.</cmd>',
          '        <info>',
          '          <p>Add parameter details or cautions here.</p>',
          '        </info>',
          '      </step>',
          '      <step>',
          '        <cmd>Verify the service status and check the output.</cmd>',
          '        <stepresult>',
          '          <p>The console reports a ready state.</p>',
          '        </stepresult>',
          '      </step>',
          '    </steps>',
          '    <result>',
          '      <p>The task is complete.</p>',
          '    </result>',
          '  </taskbody>',
          '</task>',
          '',
        ].join('\n');
      }
      const title = escapeText(options.title ?? '新建操作任务');
      const shortdesc = escapeText(
        options.shortdesc ?? '说明完成该操作任务的目标以及预计达成的结果。',
      );
      return [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<!DOCTYPE task PUBLIC "-//OASIS//DTD DITA Task//EN" "task.dtd">',
        `<task id="${id}" xml:lang="${lang}">`,
        `  <title>${title}</title>`,
        `  <shortdesc>${shortdesc}</shortdesc>`,
        '  <taskbody>',
        '    <prereq>',
        '      <p>确认已具备操作所需的环境与权限。</p>',
        '    </prereq>',
        '    <context>',
        '      <p>按以下步骤完成配置：</p>',
        '    </context>',
        '    <steps>',
        '      <step>',
        '        <cmd>执行第一步操作命令。</cmd>',
        '        <info>',
        '          <p>可在此补充参数细节或注意事项。</p>',
        '        </info>',
        '      </step>',
        '      <step>',
        '        <cmd>验证服务状态并检查输出结果。</cmd>',
        '        <stepresult>',
        '          <p>控制台返回就绪状态提示。</p>',
        '        </stepresult>',
        '      </step>',
        '    </steps>',
        '    <result>',
        '      <p>任务执行完成。</p>',
        '    </result>',
        '  </taskbody>',
        '</task>',
        '',
      ].join('\n');
    }

    case 'reference': {
      if (english) {
        const title = escapeText(options.title ?? 'New Reference Topic');
        const shortdesc = escapeText(
          options.shortdesc ?? 'Provide a quick lookup reference for options, parameters, and API specifications.',
        );
        return [
          '<?xml version="1.0" encoding="UTF-8"?>',
          '<!DOCTYPE reference PUBLIC "-//OASIS//DTD DITA Reference//EN" "reference.dtd">',
          `<reference id="${id}" xml:lang="${lang}">`,
          `  <title>${title}</title>`,
          `  <shortdesc>${shortdesc}</shortdesc>`,
          '  <refbody>',
          '    <section id="sec_parameters">',
          '      <title>Parameters</title>',
          '      <simpletable relcolwidth="1* 1* 3*">',
          '        <sthead>',
          '          <stentry>Name</stentry>',
          '          <stentry>Type</stentry>',
          '          <stentry>Description</stentry>',
          '        </sthead>',
          '        <strow>',
          '          <stentry><parmname>timeout</parmname></stentry>',
          '          <stentry><codeph>number</codeph></stentry>',
          '          <stentry>Request timeout in milliseconds. Defaults to 30000.</stentry>',
          '        </strow>',
          '      </simpletable>',
          '    </section>',
          '  </refbody>',
          '</reference>',
          '',
        ].join('\n');
      }
      const title = escapeText(options.title ?? '新建参考规格');
      const shortdesc = escapeText(
        options.shortdesc ?? '提供配置项、参数定义与接口规格的速查参考。',
      );
      return [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<!DOCTYPE reference PUBLIC "-//OASIS//DTD DITA Reference//EN" "reference.dtd">',
        `<reference id="${id}" xml:lang="${lang}">`,
        `  <title>${title}</title>`,
        `  <shortdesc>${shortdesc}</shortdesc>`,
        '  <refbody>',
        '    <section id="sec_parameters">',
        '      <title>参数列表</title>',
        '      <simpletable relcolwidth="1* 1* 3*">',
        '        <sthead>',
        '          <stentry>参数名</stentry>',
        '          <stentry>类型</stentry>',
        '          <stentry>说明</stentry>',
        '        </sthead>',
        '        <strow>',
        '          <stentry><parmname>timeout</parmname></stentry>',
        '          <stentry><codeph>number</codeph></stentry>',
        '          <stentry>请求超时时间（毫秒），默认 30000。</stentry>',
        '        </strow>',
        '      </simpletable>',
        '    </section>',
        '  </refbody>',
        '</reference>',
        '',
      ].join('\n');
    }

    case 'topic':
    default: {
      if (english) {
        const title = escapeText(options.title ?? 'New DITA Topic');
        const shortdesc = escapeText(options.shortdesc ?? 'A generic DITA topic summary.');
        return [
          '<?xml version="1.0" encoding="UTF-8"?>',
          '<!DOCTYPE topic PUBLIC "-//OASIS//DTD DITA Topic//EN" "topic.dtd">',
          `<topic id="${id}" xml:lang="${lang}">`,
          `  <title>${title}</title>`,
          `  <shortdesc>${shortdesc}</shortdesc>`,
          '  <body>',
          '    <p>Start writing here, or type <codeph>/</codeph> to open the context-aware element menu.</p>',
          '  </body>',
          '</topic>',
          '',
        ].join('\n');
      }
      const title = escapeText(options.title ?? '新建通用主题');
      const shortdesc = escapeText(
        options.shortdesc ?? '通用 DITA Topic 文档摘要。',
      );
      return [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<!DOCTYPE topic PUBLIC "-//OASIS//DTD DITA Topic//EN" "topic.dtd">',
        `<topic id="${id}" xml:lang="${lang}">`,
        `  <title>${title}</title>`,
        `  <shortdesc>${shortdesc}</shortdesc>`,
        '  <body>',
        '    <p>在此开始输入文档内容，或输入 <codeph>/</codeph> 唤起上下文合法元素插入菜单。</p>',
        '  </body>',
        '</topic>',
        '',
      ].join('\n');
    }
  }
}

export const DITA_SAMPLE_DOCUMENTS: readonly DitaSampleDocument[] = [
  {
    id: 'sample-concept',
    fileName: 'dita-architecture.dita',
    title: 'DITA 结构化写作架构概述',
    type: 'concept',
    badge: 'Concept',
    description: '包含 prolog 元数据、dl 定义列表、嵌套列表、xref 引用与 tip 提示框',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">
<concept id="dita_architecture_overview" xml:lang="zh-CN">
  <title>DITA 结构化写作架构概述</title>
  <shortdesc>介绍 DITA 1.3 的主题化写作模型、单一信息源机制与无损 XML 往返原则。</shortdesc>
  <prolog>
    <author type="creator">Zhang San</author>
    <critdates>
      <created date="2026-01-15"/>
      <revised modified="2026-10-20"/>
    </critdates>
    <metadata>
      <keywords>
        <keyword>DITA 1.3</keyword>
        <keyword>Structured Authoring</keyword>
      </keywords>
    </metadata>
  </prolog>
  <conbody>
    <!-- 段落标签与块间加号插入演示：悬停任意段落之间即可快速插入合法 DITA 块 -->
    <p>DITA（Darwin Information Typing Architecture）是一套基于 XML 的开放技术文档标准，核心强调<b>模块化</b>、<i>语义化</i>与<u>多渠道发布</u>。</p>
    <section id="sec_core_types">
      <title>核心信息类型</title>
      <dl>
        <dlentry>
          <dt>Concept</dt>
          <dd>用于解释背景原理、架构设计或业务概念，回答“是什么”与“为什么”。</dd>
        </dlentry>
        <dlentry>
          <dt>Task</dt>
          <dd>
            <p>面向操作流程与分步指南，包含前置条件与验证结果。</p>
            <p>通常配合 <codeph>steps</codeph> 元素使用。</p>
          </dd>
        </dlentry>
        <dlentry>
          <dt>Reference</dt>
          <dd>提供 API 参数、配置项和规格表格的快速查询。</dd>
        </dlentry>
      </dl>
    </section>
    <section id="sec_benefits">
      <title>关键优势</title>
      <ul>
        <li>支持跨文档 <codeph>conref</codeph> 片段复用</li>
        <li>
          <p>通过 <filepath>root.ditamap</filepath> 灵活组装不同产品版本的手册。</p>
          <ol>
            <li>统一管理 <keyword keyref="prod_name"/> 变量键值</li>
            <li>按 <xref href="ditaval-guide.dita" scope="local" format="dita">DITAVAL 条件配置</xref> 过滤输出</li>
          </ol>
        </li>
      </ul>
      <note type="tip">在多人协作仓库中，保持确定性 XML 缩进可显著降低 Git Diff 评审噪声。</note>
    </section>
  </conbody>
</concept>
`,
  },
  {
    id: 'sample-task',
    fileName: 'deploy-worker.dita',
    title: 'Deploy the DITA Validation Worker',
    type: 'task',
    badge: 'Task',
    description: '标准任务流程：prereq、steps/step/cmd、substeps、choices、codeblock 与 stepresult',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE task PUBLIC "-//OASIS//DTD DITA Task//EN" "task.dtd">
<task id="task_deploy_worker" xml:lang="en-US">
  <title>Deploy the DITA Validation Worker</title>
  <shortdesc>Configure and start the persistent Java validation and DITA-OT publishing worker.</shortdesc>
  <taskbody>
    <prereq id="prereq_env">
      <p>Ensure Docker Engine 24+ and <cmdname>docker compose</cmdname> are installed on the host.</p>
    </prereq>
    <context>
      <p>The persistent JVM worker preloads the DITA 1.3 XML Catalog grammar pool to keep validation latency under 80 ms.</p>
    </context>
    <steps>
      <step id="step_config">
        <cmd>Open <menucascade><uicontrol>Settings</uicontrol><uicontrol>Publishing</uicontrol><uicontrol>Worker</uicontrol></menucascade> in the <wintitle>Admin Console</wintitle>.</cmd>
        <info audience="admin">
          <p>Verify the endpoint URL matches your internal service network.</p>
        </info>
        <substeps>
          <substep>
            <cmd>Set <parmname>WORKER_PORT</parmname> to <userinput>8090</userinput>.</cmd>
          </substep>
          <substep>
            <cmd>Set <parmname>MAX_CONCURRENT_BUILDS</parmname> to <userinput>2</userinput>.</cmd>
          </substep>
        </substeps>
      </step>
      <step id="step_start">
        <cmd>Start the container using the deployment profile of your choice:</cmd>
        <choices>
          <choice>For local evaluation, run <cmdname>docker compose up -d</cmdname>.</choice>
          <choice>For production clusters, apply the Kubernetes manifest with <option>--namespace=docs</option>.</choice>
        </choices>
        <stepxmp>
          <codeblock outputclass="language-bash">docker compose up -d dita-worker
curl -fsS http://localhost:8090/health</codeblock>
        </stepxmp>
        <stepresult>
          <p>The health endpoint responds with <systemoutput>{"status":"ready","catalogsLoaded":true}</systemoutput>.</p>
        </stepresult>
      </step>
    </steps>
    <result>
      <p>The validation and publishing worker is now active and accepting requests from the API server.</p>
    </result>
    <postreq>
      <p>Run a sample HTML5 and PDF build to confirm Noto CJK fonts render properly.</p>
    </postreq>
  </taskbody>
  <related-links>
    <link href="../concepts/dita-architecture.dita" format="dita" type="concept"/>
  </related-links>
</task>
`,
  },
  {
    id: 'sample-reference',
    fileName: 'server-sizing-cals.dita',
    title: 'Server Sizing & API Reference',
    type: 'reference',
    badge: 'Reference',
    description: 'OASIS CALS 跨行跨列合并表格（colspec/namest/nameend/morerows）与 Simpletable',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE reference PUBLIC "-//OASIS//DTD DITA Reference//EN" "reference.dtd">
<reference id="ref_hardware_specs">
  <title>Server Sizing and API Endpoints</title>
  <shortdesc>Hardware recommendations and REST endpoint summary for team deployments.</shortdesc>
  <refbody>
    <refsyn>
      <title>Endpoint Base URL</title>
      <codeblock outputclass="language-bash">https://docs-api.internal.example.com/api/v1</codeblock>
    </refsyn>
    <section id="sec_cals_matrix">
      <title>Deployment Sizing Matrix (CALS Table)</title>
      <table id="tbl_sizing" frame="all" colsep="1" rowsep="1">
        <title>Recommended Resources by Team Size</title>
        <desc>Includes combined horizontal and vertical cell spans.</desc>
        <tgroup cols="4">
          <colspec colnum="1" colname="c1" colwidth="1.5*" align="left"/>
          <colspec colnum="2" colname="c2" colwidth="1*" align="center"/>
          <colspec colnum="3" colname="c3" colwidth="1.5*" align="right"/>
          <colspec colnum="4" colname="c4" colwidth="2*" align="left"/>
          <thead>
            <row>
              <entry colname="c1" morerows="1">Component</entry>
              <entry namest="c2" nameend="c3">Resource Allocation</entry>
              <entry colname="c4" morerows="1">Notes</entry>
            </row>
            <row>
              <entry colname="c2">CPU</entry>
              <entry colname="c3">Memory</entry>
            </row>
          </thead>
          <tbody>
            <row>
              <entry morerows="1">Java Worker</entry>
              <entry>2 vCPU</entry>
              <entry>2 GB</entry>
              <entry>
                <p>Small teams (up to 10 authors).</p>
                <p>Supports 1 concurrent PDF build.</p>
              </entry>
            </row>
            <row>
              <entry>4 vCPU</entry>
              <entry>4 GB</entry>
              <entry>Medium teams (10–50 authors).</entry>
            </row>
            <row>
              <entry namest="c1" nameend="c2">PostgreSQL + Redis</entry>
              <entry>2 GB</entry>
              <entry/>
            </row>
          </tbody>
        </tgroup>
      </table>
    </section>
    <section id="sec_simpletable">
      <title>Core Endpoints (Simpletable)</title>
      <simpletable id="st_endpoints" relcolwidth="1* 2* 3*">
        <sthead>
          <stentry>Method</stentry>
          <stentry>Path</stentry>
          <stentry>Description</stentry>
        </sthead>
        <strow>
          <stentry><codeph>POST</codeph></stentry>
          <stentry><apiname>/validate</apiname></stentry>
          <stentry>Run authoritative DTD/RNG and cross-file validation.</stentry>
        </strow>
        <strow>
          <stentry><codeph>POST</codeph></stentry>
          <stentry><apiname>/publish</apiname></stentry>
          <stentry>Enqueue an asynchronous DITA-OT HTML5 or PDF build.</stentry>
        </strow>
      </simpletable>
    </section>
  </refbody>
</reference>
`,
  },
  {
    id: 'sample-passthrough',
    fileName: 'specialized-passthrough.dita',
    title: 'Specialized & Unknown Elements',
    type: 'topic',
    badge: 'Passthrough',
    description: '未知特化标签（hazardstatement、自定义标签）、XML 注释、处理指令与 CDATA 无损保真演示',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<?xml-model href="urn:oasis:names:tc:dita:rng:topic.rng" schematypens="http://relaxng.org/ns/structure/1.0"?>
<!DOCTYPE topic PUBLIC "-//OASIS//DTD DITA Topic//EN" "topic.dtd">
<!-- Document-level editorial comment preserved losslessly -->
<topic id="topic_specialized_passthrough">
  <title>Specialized and Unknown DITA Elements</title>
  <shortdesc>Demonstrates lossless passthrough for specialized DITA 1.3 tags, custom elements, comments, and PIs.</shortdesc>
  <body>
    <!-- Inline & block specialized passthrough check -->
    <p>This document tests <tm tmtype="reg" trademark="DITAForge">DITAForge</tm>, <abbreviated-form keyref="gloss_dita"/>, custom inline tag <acme-tag env="prod" tier="gold">v2.4</acme-tag>, and a footnote<fn id="fn_complex"><p>Footnote text with <codeph>inline</codeph> code.</p></fn>.</p>
    <?oxy_comment_start author="reviewer" comment="Keep hazardstatement attributes intact"?>
    <hazardstatement id="haz_voltage" type="warning">
      <messagepanel>
        <typeofhazard>High Voltage Hazard</typeofhazard>
        <consequence>Contact may cause severe electric shock or equipment damage.</consequence>
        <howtoavoid>Disconnect all power cables before opening the chassis.</howtoavoid>
      </messagepanel>
    </hazardstatement>
    <?oxy_comment_end?>
    <screen outputclass="terminal">$ dita --input=manual.ditamap --format=pdf
[INFO] Processing completed in 4.2s
  Output: out/manual.pdf</screen>
    <acme-callout severity="high" data-owner="sec-team">
      <acme-badge code="SEC-01"/>
      <p>Custom enterprise callout block survives Visual ↔ Source round-trips with zero attribute loss.</p>
    </acme-callout>
  </body>
</topic>
`,
  },
];
