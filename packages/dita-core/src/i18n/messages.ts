/**
 * Bilingual (zh-CN / en) message catalogue for `@dita/core` diagnostics, AI splice
 * verification, and prompt scaffolding. English keys are compile-time checked against the
 * Chinese catalogue so a missing translation can never ship.
 */

import { formatMessage, type FormatMessageParams, type UiLocale } from './locale.js';

export const coreMessagesZh = {
  // Conref / conkeyref resolution
  'conref.emptyAttr': '{attr} 不能为空',
  'conref.invalidConkeyref': '无效的 conkeyref 语法："{value}"（应为 key/elementId）',
  'conref.missingKey': '未在当前 Root Map 中找到 Key 定义："{keyName}"',
  'conref.keyWithoutHref': 'Key "{keyName}" 未绑定有效的本地目标文件 href',
  'conref.targetWithoutTopicId': '目标文件 {path} 未包含有效的根 Topic ID',
  'conref.missingFragment': 'conref 缺少 #topicId/elementId 片段："{value}"',
  'conref.emptyFragment': 'conref 片段标识符不能为空："{value}"',
  'conref.unresolvablePath': '无法解析本地 conref 目标路径："{value}"',
  'conref.unresolvableTopicId': '无法解析 conref 所属 Topic ID："{value}"',
  'conref.missingTargetFile': '复用目标文件不存在：{path}',
  'conref.malformedTargetFile': '复用目标文件 XML 语法非法：{path}',
  'conref.unresolvableTargetFile': '复用目标文件不存在或无法解析：{path}',
  'conref.missingTargetId': '在 {path} 中未找到目标 ID：#{topicId}{elemId}',
  'conref.incompatibleTag': '元素类型不兼容：<{sourceTag}> 无法复用 <{targetTag}>',
  'conref.cycle': '检测到循环内容复用：{chain}',
  'conref.depthLimit': '内容复用嵌套深度超过限制 ({depth})：{chain}',
  'conref.conrefendFailed': 'conrefend 解析失败：{message}',
  'conref.conrefendDifferentParent': 'conrefend 目标 "{value}" 必须与起始目标处于同一父容器',
  'conref.conrefendOutOfOrder': 'conrefend 结束节点不能位于起始节点之前',

  // Keyspace
  'keyspace.emptyKeyref': '空的 keyref 引用',
  'keyspace.undefinedKey': '未在当前 Root Map 中找到 Key 定义："{keyName}"',

  // Semantic index diagnostics
  'semantic.malformedXml': 'XML 良构错误：{message}',
  'semantic.undefinedKeyref': '未定义的 keyref："{value}"',
  'semantic.invalidConref': '无效的内容复用：{value}',
  'semantic.ditavalSyntax': 'DITAVAL 语法错误：{message}',
  'semantic.missingImage': '引用图片不存在或超出工作区：{href}',
  'semantic.pathEscapesRoot': '引用路径超出工作区根目录：{href}',
  'semantic.missingTargetFile': '目标文件不存在：{href}（解析路径：{resolved}）',
  'semantic.mapCycle': '检测到循环子地图引用 (<mapref>)：{from} -> {to}',

  // AI target extraction
  'ai.unsupportedMode': '不支持的 AI 定位模式：{mode}',
  'ai.elementPathRequired': '元素靶向定位缺少 elementPath（[] 表示根元素，[0] 表示第一个元素子节点）。',
  'ai.missingRoot': 'XML 文档缺少根元素。',
  'ai.elementTargetNeedsWellFormed': '元素靶向定位需要良构的 XML；当前原文无法解析：{message}',
  'ai.invalidElementIndex': 'elementPath 含非法下标：{index}（必须是非负整数）。',
  'ai.elementPathOutOfRange': 'elementPath 越界：<{tag}> 没有第 {index} 个元素子节点（共 {count} 个）。',
  'ai.missingSourceRange': '无法获取 <{tag}> 的源码位置信息。',
  'ai.unreliableSourceRange': '<{tag}> 的源码位置不可靠，无法安全定位替换区间。',
  'ai.invalidStartLine': '行窗口定位的起始行无效：{line}（必须是 ≥ 1 的整数行号）。',
  'ai.invalidEndLine': '行窗口定位的结束行无效：{line}（必须 ≥ 起始行 {startLine}）。',

  // AI splice + verification
  'ai.candidateEmpty': 'AI 返回的候选片段为空。',
  'ai.candidateEmptyWarning': '候选片段为空，请返回完整的 XML 片段。',
  'ai.candidateNoRoot': '候选片段没有根元素。',
  'ai.candidateMalformed': '候选片段不是良构的单个 XML 元素：{detail}',
  'ai.candidateMalformedWarning': '候选片段良构性校验失败：{detail}',
  'ai.unsupportedTargetMode': '不支持的定位模式：{mode}。',
  'ai.invalidRange': '无效的替换区间 [{start}, {end})，原文长度为 {length}。',
  'ai.invalidRangeWarning': '替换区间 [{start}, {end}) 超出原文范围。',
  'ai.originalMismatch': '提取结果与当前原文不一致，请重新定位目标片段后再回拼。',
  'ai.originalMismatchWarning': '提取时使用的原文与本次回拼的原文不一致（文件可能已被修改）。',
  'ai.wrapperRemoved': '候选片段中的 Markdown 代码围栏 / 包装元素 / 序言已被移除。',
  'ai.prologReused': '已逐字复用原始 XML 声明 / DOCTYPE / 序言。',
  'ai.childNotAllowed': '<{child}> 不允许作为 <{parent}> 的子元素。',
  'ai.rootChanged': '根元素被改动：<{from}> → <{to}>。',
  'ai.visualConversionFailed': 'Visual 模式转换失败：{message}',
  'ai.patchedMalformedAt': '回拼后 XML 非良构：第 {line} 行第 {column} 列 {message}',
  'ai.patchedMalformed': '回拼后 XML 非良构：{message}',
  'ai.declarationChanged': '回拼后 XML 声明被改动：{from} → {to}。',
  'ai.doctypeChanged': '回拼后 DOCTYPE 被改动：{from} → {to}。',
  'ai.visualIncompatible': '回拼后的文档无法在 Visual（ProseMirror）模式中无损渲染。',
  'ai.structureInvalid': '回拼后的文档结构不合法。',
  'ai.none': '(无)',

  // AI constraint prompt
  'ai.prompt.role': '你是严格遵循 OASIS DITA 1.3 的结构化 XML 编写助手。只输出 XML 片段本身：不要 Markdown 代码围栏，不要解释文字。',
  'ai.prompt.rootTag': '当前文档根元素：<{rootTag}>。',
  'ai.prompt.singleFragment': '本次只返回一个可插入 <{parentTag}> 的完整片段，片段顶层元素必须是 <{parentTag}> 的合法子元素。',
  'ai.prompt.allowedChildren': '<{parentTag}> 允许的子元素（仅限这些）：{children}{suffix}。',
  'ai.prompt.unmodeledParent': '<{parentTag}> 未在内置模型中建模：请沿用原文已有的子元素类型与层级，不要新增元素类型。',
  'ai.prompt.fragmentAnyParent': '本次需要返回一个良构的 XML 片段：单个顶层元素，且该元素类型与原文保持一致（父元素未建模）。',
  'ai.prompt.inlineElements': '行内语义元素（只能出现在行内内容中）：{tags}。',
  'ai.prompt.commonAttributes': '通用属性：{attributes}；不要虚构未列出的元素、属性或 keyref/conref 目标。',
  'ai.prompt.hardRequirements': '硬性要求：',
  'ai.prompt.preserveText': '1) 未修改的文本、属性顺序、注释、处理指令必须原样保留；',
  'ai.prompt.preserveWhitespace': '2) <codeblock>/<pre>/<lines>/<screen>/<msgblock> 以及 xml:space="preserve" 元素内的空白与缩进必须逐字节保留，不要重新缩进；',
  'ai.prompt.quoteAttributes': '3) 属性值使用双引号，并正确转义 &、<、>；',
  'ai.prompt.noProlog': '4) 不要输出 XML 声明或 DOCTYPE（由系统统一维护）；',
  'ai.prompt.wellFormed': '5) 输出必须是良构 XML，且不要包裹在 <dita_patch> 之类的包装元素中。',
} as const;

export type CoreMessageKey = keyof typeof coreMessagesZh;

export const coreMessagesEn: Record<CoreMessageKey, string> = {
  'conref.emptyAttr': '{attr} must not be empty',
  'conref.invalidConkeyref': 'Invalid conkeyref syntax: "{value}" (expected key/elementId)',
  'conref.missingKey': 'Key definition not found in the current Root Map: "{keyName}"',
  'conref.keyWithoutHref': 'Key "{keyName}" is not bound to a valid local target href',
  'conref.targetWithoutTopicId': 'Target file {path} does not contain a valid root Topic ID',
  'conref.missingFragment': 'conref is missing a #topicId/elementId fragment: "{value}"',
  'conref.emptyFragment': 'conref fragment identifier must not be empty: "{value}"',
  'conref.unresolvablePath': 'Unable to resolve the local conref target path: "{value}"',
  'conref.unresolvableTopicId': 'Unable to resolve the Topic ID owning this conref: "{value}"',
  'conref.missingTargetFile': 'Reuse target file does not exist: {path}',
  'conref.malformedTargetFile': 'Reuse target file is not well-formed XML: {path}',
  'conref.unresolvableTargetFile': 'Reuse target file is missing or unparsable: {path}',
  'conref.missingTargetId': 'Target ID not found in {path}: #{topicId}{elemId}',
  'conref.incompatibleTag': 'Incompatible element types: <{sourceTag}> cannot reuse <{targetTag}>',
  'conref.cycle': 'Circular content reuse detected: {chain}',
  'conref.depthLimit': 'Content reuse nesting depth exceeds the limit ({depth}): {chain}',
  'conref.conrefendFailed': 'Failed to resolve conrefend: {message}',
  'conref.conrefendDifferentParent': 'conrefend target "{value}" must share the same parent container as the start target',
  'conref.conrefendOutOfOrder': 'conrefend end node cannot precede the start node',

  'keyspace.emptyKeyref': 'Empty keyref reference',
  'keyspace.undefinedKey': 'Key definition not found in the current Root Map: "{keyName}"',

  'semantic.malformedXml': 'XML well-formedness error: {message}',
  'semantic.undefinedKeyref': 'Undefined keyref: "{value}"',
  'semantic.invalidConref': 'Invalid content reuse: {value}',
  'semantic.ditavalSyntax': 'DITAVAL syntax error: {message}',
  'semantic.missingImage': 'Referenced image is missing or outside the workspace: {href}',
  'semantic.pathEscapesRoot': 'Reference path escapes the workspace root: {href}',
  'semantic.missingTargetFile': 'Target file does not exist: {href} (resolved path: {resolved})',
  'semantic.mapCycle': 'Circular sub-map reference (<mapref>) detected: {from} -> {to}',

  'ai.unsupportedMode': 'Unsupported AI targeting mode: {mode}',
  'ai.elementPathRequired': 'Element targeting requires elementPath ([] = root element, [0] = first element child).',
  'ai.missingRoot': 'The XML document has no root element.',
  'ai.elementTargetNeedsWellFormed': 'Element targeting requires well-formed XML; the current source cannot be parsed: {message}',
  'ai.invalidElementIndex': 'elementPath contains an invalid index: {index} (must be a non-negative integer).',
  'ai.elementPathOutOfRange': 'elementPath out of range: <{tag}> has no element child at index {index} (total {count}).',
  'ai.missingSourceRange': 'Unable to obtain source positions for <{tag}>.',
  'ai.unreliableSourceRange': 'Source positions for <{tag}> are unreliable; refusing to compute a replacement range.',
  'ai.invalidStartLine': 'Invalid line-window start line: {line} (must be an integer ≥ 1).',
  'ai.invalidEndLine': 'Invalid line-window end line: {line} (must be ≥ start line {startLine}).',

  'ai.candidateEmpty': 'The AI returned an empty candidate fragment.',
  'ai.candidateEmptyWarning': 'The candidate fragment is empty; return a complete XML fragment.',
  'ai.candidateNoRoot': 'The candidate fragment has no root element.',
  'ai.candidateMalformed': 'The candidate is not a single well-formed XML element: {detail}',
  'ai.candidateMalformedWarning': 'Candidate well-formedness check failed: {detail}',
  'ai.unsupportedTargetMode': 'Unsupported targeting mode: {mode}.',
  'ai.invalidRange': 'Invalid replacement range [{start}, {end}); the source is {length} characters long.',
  'ai.invalidRangeWarning': 'Replacement range [{start}, {end}) is outside the source document.',
  'ai.originalMismatch': 'The extracted fragment no longer matches the current source; re-locate the target before splicing.',
  'ai.originalMismatchWarning': 'The source used for extraction differs from this splice (the file may have changed).',
  'ai.wrapperRemoved': 'Markdown code fences / wrapper elements / prolog were stripped from the candidate.',
  'ai.prologReused': 'The original XML declaration / DOCTYPE / prolog was reused byte-for-byte.',
  'ai.childNotAllowed': '<{child}> is not allowed as a child of <{parent}>.',
  'ai.rootChanged': 'Root element changed: <{from}> → <{to}>.',
  'ai.visualConversionFailed': 'Visual mode conversion failed: {message}',
  'ai.patchedMalformedAt': 'Patched XML is not well-formed: line {line}, column {column}: {message}',
  'ai.patchedMalformed': 'Patched XML is not well-formed: {message}',
  'ai.declarationChanged': 'XML declaration changed after splicing: {from} → {to}.',
  'ai.doctypeChanged': 'DOCTYPE changed after splicing: {from} → {to}.',
  'ai.visualIncompatible': 'The patched document cannot round-trip through Visual (ProseMirror) mode.',
  'ai.structureInvalid': 'The patched document has an invalid structure.',
  'ai.none': '(none)',

  'ai.prompt.role': 'You are a structured XML authoring assistant that strictly follows OASIS DITA 1.3. Output only the XML fragment itself: no Markdown code fences, no explanatory prose.',
  'ai.prompt.rootTag': 'Root element of the current document: <{rootTag}>.',
  'ai.prompt.singleFragment': 'Return exactly one complete fragment that can be inserted into <{parentTag}>; every top-level element must be a valid child of <{parentTag}>.',
  'ai.prompt.allowedChildren': 'Allowed children of <{parentTag}> (only these): {children}{suffix}.',
  'ai.prompt.unmodeledParent': '<{parentTag}> is not modeled in the built-in schema: keep the existing child element types and nesting, and do not introduce new element types.',
  'ai.prompt.fragmentAnyParent': 'Return one well-formed XML fragment: a single top-level element whose type matches the source (the parent is not modeled).',
  'ai.prompt.inlineElements': 'Inline semantic elements (inline content only): {tags}.',
  'ai.prompt.commonAttributes': 'Common attributes: {attributes}; never invent elements, attributes, or keyref/conref targets that are not listed.',
  'ai.prompt.hardRequirements': 'Hard requirements: ',
  'ai.prompt.preserveText': '1) Unmodified text, attribute order, comments, and processing instructions must be preserved verbatim; ',
  'ai.prompt.preserveWhitespace': '2) Whitespace and indentation inside <codeblock>/<pre>/<lines>/<screen>/<msgblock> and xml:space="preserve" elements must be preserved byte-for-byte; never re-indent; ',
  'ai.prompt.quoteAttributes': '3) Use double quotes for attribute values and escape &, <, > correctly; ',
  'ai.prompt.noProlog': '4) Do not output an XML declaration or DOCTYPE (the system maintains them); ',
  'ai.prompt.wellFormed': '5) The output must be well-formed XML and must not be wrapped in <dita_patch> or similar wrapper elements.',
};

const CATALOGUES: Record<UiLocale, Record<CoreMessageKey, string>> = {
  'zh-CN': coreMessagesZh,
  en: coreMessagesEn,
};

export function coreT(
  locale: UiLocale | string | null | undefined,
  key: CoreMessageKey,
  params?: FormatMessageParams,
): string {
  const catalogue = CATALOGUES[locale === 'en' ? 'en' : 'zh-CN'] ?? coreMessagesZh;
  return formatMessage(catalogue[key], params);
}
