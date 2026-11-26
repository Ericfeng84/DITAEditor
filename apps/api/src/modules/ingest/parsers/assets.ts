import { copyFile, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { basename, extname, join, relative } from 'node:path';
import {
  extractDataUriImages,
  type ExtractedDataUriImage,
  type ExtractedIngestAsset,
} from '@dita/core';

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.tif', '.tiff']);

export const ASSET_SCHEME = 'asset://';

/** Encodes `img_001` style ids with a stable 3-digit suffix (widening past `img_999`). */
export function assetIdFor(index: number): string {
  return `img_${String(index).padStart(3, '0')}`;
}

/** Highest `img_NNN` index already referenced by the Markdown, so new assets never collide. */
export function highestAssetIndex(markdown: string): number {
  let highest = 0;
  for (const match of markdown.matchAll(/asset:\/\/img_(\d+)\./g)) {
    const index = Number.parseInt(match[1] ?? '0', 10);
    if (Number.isFinite(index)) highest = Math.max(highest, index);
  }
  return highest;
}

function normalizeExtensionForAsset(extension: string): string {
  const lower = extension.toLowerCase();
  return lower === 'jpeg' ? 'jpg' : lower === 'svg+xml' ? 'svg' : lower;
}

/** Writes data-URI images to `assetsDir` and returns their asset metadata. */
export async function saveDataUriImages(
  images: readonly ExtractedDataUriImage[],
  assetsDir: string,
): Promise<ExtractedIngestAsset[]> {
  if (images.length === 0) return [];
  await mkdir(assetsDir, { recursive: true });
  const assets: ExtractedIngestAsset[] = [];
  for (const image of images) {
    const fileName = `${image.assetId}.${normalizeExtensionForAsset(image.extension)}`;
    await writeFile(join(assetsDir, fileName), Buffer.from(image.base64, 'base64'));
    assets.push({
      assetId: image.assetId,
      fileName,
      mediaType: image.mimeType,
      extension: normalizeExtensionForAsset(image.extension),
      byteLength: image.byteLength,
      base64: image.base64,
      origin: 'data-uri',
    });
  }
  return assets;
}

/** Recursively lists files under `dir` with the given extensions (sorted for determinism). */
async function listFilesRecursive(dir: string, extensions: Set<string>): Promise<string[]> {
  const found: string[] = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return found;
  }
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...(await listFilesRecursive(full, extensions)));
      continue;
    }
    if (extensions.has(extname(entry.name).toLowerCase())) found.push(full);
  }
  return found;
}

export interface CopyReferencedImagesOptions {
  sourceDirs: readonly string[];
  assetsDir: string;
  startIndex?: number;
}

export interface CopyReferencedImagesResult {
  markdown: string;
  assets: ExtractedIngestAsset[];
}

/**
 * Copies images referenced by the Markdown out of parser output directories into `assetsDir`
 * as `img_NNN.<ext>` and rewrites the references to `asset://img_NNN.<ext>`. Remote URLs and
 * existing `asset://` references are left untouched.
 */
export async function copyReferencedImages(
  markdown: string,
  options: CopyReferencedImagesOptions,
): Promise<CopyReferencedImagesResult> {
  const imageFiles: string[] = [];
  for (const dir of options.sourceDirs) {
    imageFiles.push(...(await listFilesRecursive(dir, IMAGE_EXTENSIONS)));
  }
  if (imageFiles.length === 0) {
    return { markdown: stripDataUris(markdown), assets: [] };
  }

  await mkdir(options.assetsDir, { recursive: true });
  const byPath = new Map<string, string>();
  const byName = new Map<string, string>();
  const assets: ExtractedIngestAsset[] = [];
  let index = options.startIndex ?? 1;

  for (const file of imageFiles) {
    const extension = extname(file).slice(1).toLowerCase();
    const assetId = assetIdFor(index++);
    const fileName = `${assetId}.${normalizeExtensionForAsset(extension)}`;
    await copyFile(file, join(options.assetsDir, fileName));
    const stat = await readFile(file);
    const sourceDir = options.sourceDirs.find((dir) => file.startsWith(dir)) ?? '';
    const relPath = sourceDir ? relative(sourceDir, file).split('\\').join('/') : basename(file);
    byPath.set(relPath, fileName);
    byPath.set(`./${relPath}`, fileName);
    if (!byName.has(basename(file))) byName.set(basename(file), fileName);
    assets.push({
      assetId,
      fileName,
      mediaType: mediaTypeForExtension(extension),
      extension: normalizeExtensionForAsset(extension),
      byteLength: stat.byteLength,
      origin: 'referenced',
      sourcePath: file,
    });
  }

  const rewritten = markdown.replace(
    /!\[([^\]]*)\]\(\s*([^)\s]+)(\s+"[^"]*")?\s*\)/g,
    (match, alt: string, target: string, title: string | undefined) => {
      if (!target || /^(?:[a-z]+:|\/\/)/i.test(target)) return match;
      const cleaned = target.split('#')[0]!.split('?')[0]!.replace(/\\/g, '/');
      const fileName =
        byPath.get(cleaned) ?? byPath.get(cleaned.replace(/^\.\//, '')) ?? byName.get(basename(cleaned));
      if (!fileName) return match;
      return `![${alt}](${ASSET_SCHEME}${fileName}${title ?? ''})`;
    },
  );

  return { markdown: stripDataUris(rewritten), assets };
}

/** Removes any leftover data URIs that were not converted into assets. */
function stripDataUris(markdown: string): string {
  return markdown.replace(/data:image\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=\s]+/gi, '');
}

function mediaTypeForExtension(extension: string): string {
  const lower = extension.toLowerCase();
  if (lower === 'jpg' || lower === 'jpeg') return 'image/jpeg';
  if (lower === 'svg') return 'image/svg+xml';
  if (lower === 'tif' || lower === 'tiff') return 'image/tiff';
  return `image/${lower}`;
}

/**
 * Shared post-processing for every parser: lifts data URIs out of the Markdown, then copies any
 * images the engine wrote beside its output and rewrites those references too.
 */
export async function materializeMarkdownAssets(
  markdown: string,
  assetsDir: string,
  referencedDirs: readonly string[] = [],
): Promise<{ markdown: string; assets: ExtractedIngestAsset[] }> {
  const extracted = extractDataUriImages(markdown);
  const dataUriAssets = await saveDataUriImages(extracted.images, assetsDir);
  const startIndex = highestAssetIndex(extracted.markdown) + 1;

  if (referencedDirs.length === 0) {
    return { markdown: extracted.markdown, assets: dataUriAssets };
  }

  const copied = await copyReferencedImages(extracted.markdown, {
    sourceDirs: referencedDirs,
    assetsDir,
    startIndex,
  });
  return {
    markdown: copied.markdown,
    assets: [...dataUriAssets, ...copied.assets],
  };
}

/** Finds the Markdown file a CLI engine produced inside its output directory. */
export async function findProducedMarkdown(outputDir: string): Promise<string | null> {
  const files = await listFilesRecursive(outputDir, new Set(['.md', '.markdown']));
  if (files.length === 0) return null;
  return files[0] ?? null;
}

export async function readTextFile(path: string): Promise<string> {
  return await readFile(path, 'utf8');
}

export type { ExtractedIngestAsset };
