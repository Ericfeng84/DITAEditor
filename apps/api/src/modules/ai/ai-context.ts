import type { TopicIdIndexEntry } from '@dita/core';
import type { WorkspaceSemanticIndexer } from '../indexer/semantic-indexer.js';

const MAX_KEYSPACE_ENTRIES = 60;
const MAX_TOPIC_ENTRIES = 60;
const MAX_CATALOG_CHARS = 1500;
const TRUNCATION_NOTICE = '…（已截断）';

export interface AiContextInput {
  indexer: WorkspaceSemanticIndexer;
  rootMapPath: string | null;
  ditavalPath: string | null;
  branch: string;
  currentFilePath: string | null;
}

export interface AiProjectContext {
  keyspaceSummary: string;
  pathIndexSummary: string;
  profilingSummary: string;
  badges: string[];
}

export const EMPTY_AI_CONTEXT: AiProjectContext = {
  keyspaceSummary: '',
  pathIndexSummary: '',
  profilingSummary: '',
  badges: [],
};

/** Deterministic, character-capped truncation with an explicit notice for prompt context. */
export function truncateWithNotice(
  text: string,
  maxChars: number,
  notice = TRUNCATION_NOTICE,
): string {
  if (maxChars <= 0) return '';
  if (text.length <= maxChars) return text;
  if (maxChars <= notice.length) return notice.slice(0, maxChars);
  return `${text.slice(0, maxChars - notice.length)}${notice}`;
}

function keyDefinitionLine(definition: {
  qualifiedKey: string;
  inlineText?: string;
  targetTitle?: string;
  resolvedHref?: string;
  href?: string;
  sourceMapPath: string;
}): string {
  const label =
    definition.inlineText?.trim() ||
    definition.targetTitle?.trim() ||
    definition.resolvedHref?.trim() ||
    definition.href?.trim() ||
    definition.sourceMapPath;
  return `- ${definition.qualifiedKey}: ${label}`;
}

function topicIndexLine(entry: TopicIdIndexEntry, currentFilePath: string | null): string {
  const id = entry.rootTopicId ? ` #${entry.rootTopicId}` : '';
  const title = entry.title?.trim() ? ` — ${entry.title.trim()}` : '';
  const current = currentFilePath === entry.filePath ? '（当前文件）' : '';
  return `- ${entry.filePath}${id}${title}${current}`;
}

/**
 * Builds compact, capped project context for the prompt. Missing root maps or indexer failures
 * degrade silently to empty summaries — AI assistance must never block on indexing.
 */
export async function buildAiContext(input: AiContextInput): Promise<AiProjectContext> {
  try {
    const semantic = await input.indexer.getSemanticContext(
      input.rootMapPath,
      input.ditavalPath,
      input.branch,
    );
    const badges: string[] = [];
    let keyspaceSummary = '';
    let pathIndexSummary = '';
    let profilingSummary = '';

    const keyDefinitions = semantic.keyspace
      ? Object.values(semantic.keyspace.keys).sort((a, b) =>
          a.qualifiedKey.localeCompare(b.qualifiedKey),
        )
      : [];
    if (keyDefinitions.length > 0) {
      const lines = keyDefinitions.slice(0, MAX_KEYSPACE_ENTRIES).map(keyDefinitionLine);
      if (keyDefinitions.length > MAX_KEYSPACE_ENTRIES) {
        lines.push(`…共 ${keyDefinitions.length} 个键，仅列出前 ${MAX_KEYSPACE_ENTRIES} 个`);
      }
      keyspaceSummary = truncateWithNotice(lines.join('\n'), MAX_CATALOG_CHARS);
      badges.push(`键空间 ${keyDefinitions.length} 个键`);
    }

    const topicIndices = [...semantic.topicIndices].sort((a, b) =>
      a.filePath.localeCompare(b.filePath),
    );
    if (topicIndices.length > 0) {
      const lines = topicIndices
        .slice(0, MAX_TOPIC_ENTRIES)
        .map((entry) => topicIndexLine(entry, input.currentFilePath));
      if (topicIndices.length > MAX_TOPIC_ENTRIES) {
        lines.push(`…共 ${topicIndices.length} 个主题，仅列出前 ${MAX_TOPIC_ENTRIES} 个`);
      }
      pathIndexSummary = truncateWithNotice(lines.join('\n'), MAX_CATALOG_CHARS);
      badges.push(`路径与 ID 索引 ${topicIndices.length} 个主题`);
    }

    const profilingLines = Object.entries(semantic.profilingCatalog ?? {})
      .filter(([, values]) => values.length > 0)
      .map(([attr, values]) => `- ${attr}: ${[...values].sort().join(', ')}`);
    if (profilingLines.length > 0) {
      profilingSummary = truncateWithNotice(profilingLines.join('\n'), MAX_CATALOG_CHARS);
      badges.push(`DITAVAL 属性 ${profilingLines.length} 类`);
    }

    return { keyspaceSummary, pathIndexSummary, profilingSummary, badges };
  } catch {
    return EMPTY_AI_CONTEXT;
  }
}
