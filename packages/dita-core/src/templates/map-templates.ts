/**
 * Standard DITA 1.3 `.ditamap` and `.bookmap` creation templates.
 */

export type DitaMapTemplateType = 'map' | 'bookmap';

export interface CreateMapTemplateOptions {
  id?: string;
  title?: string;
  lang?: string;
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
 * Generate a clean, OASIS-compliant DITA 1.3 Map or Bookmap XML document.
 */
export function createMapTemplate(
  kind: DitaMapTemplateType,
  options: CreateMapTemplateOptions = {},
): string {
  const lang = options.lang ?? 'zh-CN';
  const id = sanitizeId(options.id ?? `${kind}_${Date.now().toString(36)}`, `${kind}_root`);

  if (kind === 'bookmap') {
    const title = escapeText(options.title ?? '新建产品技术手册');
    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<!DOCTYPE bookmap PUBLIC "-//OASIS//DTD DITA BookMap//EN" "bookmap.dtd">',
      `<bookmap id="${id}" xml:lang="${lang}">`,
      '  <booktitle>',
      `    <mainbooktitle>${title}</mainbooktitle>`,
      '    <booktitlealt>DITA 1.3 产品管理员与开发指南</booktitlealt>',
      '  </booktitle>',
      '  <frontmatter>',
      '    <booklists>',
      '      <toc/>',
      '    </booklists>',
      '  </frontmatter>',
      '  <chapter navtitle="第 1 章 概述"/>',
      '  <appendix navtitle="附录参考"/>',
      '</bookmap>',
      '',
    ].join('\n');
  }

  const title = escapeText(options.title ?? '新建 DITA Map');
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE map PUBLIC "-//OASIS//DTD DITA Map//EN" "map.dtd">',
    `<map id="${id}" xml:lang="${lang}">`,
    `  <title>${title}</title>`,
    '  <topichead navtitle="核心内容"/>',
    '</map>',
    '',
  ].join('\n');
}
