import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { mkdir, readFile, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { checkXmlWellFormed } from '@dita/core';
import {
  extractFontFace,
  fontExtensionForVersion,
  readFontFaceNames,
} from '../src/modules/dita-ot/font-collections.js';
import {
  applyFopFontEntries,
  applyFontBase,
  discoverNotoCjkFontFiles,
  fontFailureHintKey,
  materializeNotoFopFonts,
  planNotoFopFonts,
  renderFopFontsSection,
  type FopFontEntry,
} from '../src/modules/dita-ot/fop-font-config.js';

const OTTO = 0x4f54544f;
const TRUE_TYPE = 0x00010000;
const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) rmSync(tempDirs.pop()!, { recursive: true, force: true });
});

function tempDir(): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'dita-fonts-'));
  tempDirs.push(dir);
  return dir;
}

interface FaceSpec {
  version?: number;
  family: string;
  subFamily: string;
  fullName?: string;
  postScript?: string;
  extraTables?: Record<string, Buffer>;
}

/** Builds a `name` table with one Windows Unicode US-English record per string. */
function nameTable(face: FaceSpec): Buffer {
  const strings: Array<[number, string]> = [
    [1, face.family],
    [2, face.subFamily],
    [4, face.fullName ?? (face.subFamily === 'Regular' ? face.family : `${face.family} ${face.subFamily}`)],
    [6, face.postScript ?? `${face.family.replace(/\s+/g, '')}-${face.subFamily}`],
  ];
  const headerLength = 6 + strings.length * 12;
  const header = Buffer.alloc(headerLength);
  header.writeUInt16BE(0, 0);
  header.writeUInt16BE(strings.length, 2);
  header.writeUInt16BE(headerLength, 4);
  const data: Buffer[] = [];
  let offset = 0;
  strings.forEach(([nameId, value], index) => {
    const encoded = Buffer.from(value, 'utf16le').swap16();
    const entry = 6 + index * 12;
    header.writeUInt16BE(3, entry);
    header.writeUInt16BE(1, entry + 2);
    header.writeUInt16BE(0x409, entry + 4);
    header.writeUInt16BE(nameId, entry + 6);
    header.writeUInt16BE(encoded.length, entry + 8);
    header.writeUInt16BE(offset, entry + 10);
    data.push(encoded);
    offset += encoded.length;
  });
  return Buffer.concat([header, ...data]);
}

function faceTables(face: FaceSpec): Array<[string, Buffer]> {
  const tables: Array<[string, Buffer]> = [['name', nameTable(face)]];
  for (const [tag, content] of Object.entries(face.extraTables ?? {})) tables.push([tag, content]);
  return tables.sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
}

/** Standalone sfnt: header + directory + table data, offsets relative to the file start. */
function buildSingleFace(face: FaceSpec): Buffer {
  const tables = faceTables(face);
  const headerLength = 12 + tables.length * 16;
  const header = Buffer.alloc(headerLength);
  header.writeUInt32BE(face.version ?? OTTO, 0);
  header.writeUInt16BE(tables.length, 4);
  header.writeUInt16BE(tables.length * 16, 6);
  header.writeUInt16BE(0, 8);
  header.writeUInt16BE(0, 10);
  const data: Buffer[] = [];
  let position = headerLength;
  tables.forEach(([tag, content], index) => {
    const entry = 12 + index * 16;
    header.write(tag, entry, 4, 'latin1');
    header.writeUInt32BE(0, entry + 4);
    header.writeUInt32BE(position, entry + 8);
    header.writeUInt32BE(content.length, entry + 12);
    const padding = (4 - (content.length % 4)) % 4;
    data.push(content, Buffer.alloc(padding));
    position += content.length + padding;
  });
  return Buffer.concat([header, ...data]);
}

/** TTC with one contiguous sfnt region per face and absolute table offsets, as Debian ships. */
function buildCollection(faces: FaceSpec[]): Buffer {
  const headerLength = 12 + faces.length * 4;
  const header = Buffer.alloc(headerLength);
  header.write('ttcf', 0, 'latin1');
  header.writeUInt32BE(0x00010000, 4);
  header.writeUInt32BE(faces.length, 8);
  const regions: Buffer[] = [];
  let position = headerLength;
  faces.forEach((face, faceIndex) => {
    header.writeUInt32BE(position, 12 + faceIndex * 4);
    const tables = faceTables(face);
    const directoryLength = 12 + tables.length * 16;
    const directory = Buffer.alloc(directoryLength);
    directory.writeUInt32BE(face.version ?? OTTO, 0);
    directory.writeUInt16BE(tables.length, 4);
    directory.writeUInt16BE(tables.length * 16, 6);
    directory.writeUInt16BE(0, 8);
    directory.writeUInt16BE(0, 10);
    const data: Buffer[] = [];
    let dataPosition = position + directoryLength;
    tables.forEach(([tag, content], index) => {
      const entry = 12 + index * 16;
      directory.write(tag, entry, 4, 'latin1');
      directory.writeUInt32BE(0, entry + 4);
      // Table offsets inside a collection are absolute file offsets.
      directory.writeUInt32BE(dataPosition, entry + 8);
      directory.writeUInt32BE(content.length, entry + 12);
      const padding = (4 - (content.length % 4)) % 4;
      data.push(content, Buffer.alloc(padding));
      dataPosition += content.length + padding;
    });
    const region = Buffer.concat([directory, ...data]);
    regions.push(region);
    position += region.length;
  });
  return Buffer.concat([header, ...regions]);
}

const SC_REGULAR: FaceSpec = {
  family: 'Noto Sans CJK SC',
  subFamily: 'Regular',
  postScript: 'NotoSansCJKsc-Regular',
};
const SC_BOLD: FaceSpec = {
  family: 'Noto Sans CJK SC',
  subFamily: 'Bold',
  postScript: 'NotoSansCJKsc-Bold',
};
const MONO_SC_REGULAR: FaceSpec = {
  family: 'Noto Sans Mono CJK SC',
  subFamily: 'Regular',
  postScript: 'NotoSansMonoCJKsc-Regular',
};

function writeTemp(dir: string, name: string, content: Buffer): string {
  const target = path.join(dir, name);
  writeFileSync(target, content);
  return target;
}

describe('readFontFaceNames', () => {
  it('reads the family, style and full name of a standalone face', async () => {
    const dir = tempDir();
    const file = writeTemp(dir, 'NotoSansCJKsc-Regular.otf', buildSingleFace(SC_REGULAR));
    const faces = await readFontFaceNames(file);
    expect(faces).toHaveLength(1);
    expect(faces[0]).toMatchObject({
      familyName: 'Noto Sans CJK SC',
      subFamilyName: 'Regular',
      // FOP matches `sub-font` against exactly this value.
      fullName: 'Noto Sans CJK SC',
      postScriptName: 'NotoSansCJKsc-Regular',
    });
  });

  it('reads every face of a collection in face order', async () => {
    const dir = tempDir();
    const file = writeTemp(dir, 'NotoSansCJK-Regular.ttc', buildCollection([SC_REGULAR, MONO_SC_REGULAR]));
    const faces = await readFontFaceNames(file);
    expect(faces.map((face) => face.fullName)).toEqual([
      'Noto Sans CJK SC',
      'Noto Sans Mono CJK SC',
    ]);
  });

  it('reports a bold face with the weight in its full name', async () => {
    const dir = tempDir();
    const file = writeTemp(dir, 'NotoSansCJK-Bold.ttc', buildCollection([SC_BOLD]));
    const faces = await readFontFaceNames(file);
    expect(faces[0]?.fullName).toBe('Noto Sans CJK SC Bold');
    expect(faces[0]?.subFamilyName).toBe('Bold');
  });

  it('returns nothing for missing, tiny or non-font files', async () => {
    const dir = tempDir();
    const junk = writeTemp(dir, 'NotoSans-Junk.ttc', Buffer.from('not a font at all'));
    expect(await readFontFaceNames(path.join(dir, 'missing.ttc'))).toEqual([]);
    expect(await readFontFaceNames(junk)).toEqual([]);
  });
});

describe('extractFontFace', () => {
  it('repacks one collection face into a standalone sfnt', async () => {
    const dir = tempDir();
    const source = writeTemp(
      dir,
      'NotoSansCJK-Bold.ttc',
      buildCollection([SC_REGULAR, SC_BOLD]),
    );
    const target = path.join(dir, 'noto-sans-cjk-sc-bold.otf');
    expect(await extractFontFace(source, 'Noto Sans CJK SC Bold', target)).toBe(true);
    const written = await readFile(target);
    expect(written.readUInt32BE(0)).toBe(OTTO);
    expect(written.readUInt16BE(4)).toBe(1);
    const names = await readFontFaceNames(target);
    expect(names.map((face) => face.fullName)).toEqual(['Noto Sans CJK SC Bold']);
    // Every table is inside the new file: the old absolute offsets must not survive.
    const numTables = written.readUInt16BE(4);
    for (let index = 0; index < numTables; index += 1) {
      const entry = 12 + index * 16;
      const offset = written.readUInt32BE(entry + 8);
      const length = written.readUInt32BE(entry + 12);
      expect(offset + length).toBeLessThanOrEqual(written.length);
    }
  });

  it('copies every table byte for byte', async () => {
    const dir = tempDir();
    const extra = Buffer.from('glyph data placeholder');
    const source = writeTemp(
      dir,
      'NotoSansCJK-Regular.otf',
      buildSingleFace({ ...SC_REGULAR, extraTables: { glyf: extra } }),
    );
    const target = path.join(dir, 'out.otf');
    expect(await extractFontFace(source, 'Noto Sans CJK SC', target)).toBe(true);
    expect((await readFile(target)).includes(extra)).toBe(true);
  });

  it('keeps TrueType flavours when the face is not CFF', async () => {
    const dir = tempDir();
    const source = writeTemp(dir, 'NotoSansCJK-Regular.ttf', buildSingleFace({ ...SC_REGULAR, version: TRUE_TYPE }));
    const target = path.join(dir, 'out.ttf');
    expect(await extractFontFace(source, 'Noto Sans CJK SC', target)).toBe(true);
    expect((await readFile(target)).readUInt32BE(0)).toBe(TRUE_TYPE);
  });

  it('refuses an unknown face name and leaves no file behind', async () => {
    const dir = tempDir();
    const source = writeTemp(dir, 'NotoSansCJK-Regular.ttc', buildCollection([SC_REGULAR]));
    const target = path.join(dir, 'missing.otf');
    expect(await extractFontFace(source, 'Noto Sans CJK SC Bold', target)).toBe(false);
    await expect(stat(target)).rejects.toThrow();
  });
});

describe('planNotoFopFonts', () => {
  async function discovered(dir: string, file: string, faces: FaceSpec[]) {
    const facesInfo = await readFontFaceNames(writeTemp(dir, file, buildCollection(faces)));
    return {
      file,
      faces: facesInfo.map((names, index) => ({
        names,
        sfntVersion: faces[index]?.version ?? OTTO,
        tables: [],
      })),
    };
  }

  it('registers the four style/weight triplets FOP needs for one family', async () => {
    const dir = tempDir();
    const regular = await discovered(dir, 'NotoSansCJK-Regular.ttc', [SC_REGULAR, MONO_SC_REGULAR]);
    const bold = await discovered(dir, 'NotoSansCJK-Bold.ttc', [SC_BOLD]);
    const plan = planNotoFopFonts([regular, bold]);
    expect(plan.map((entry) => `${entry.fontFamily}|${entry.style}|${entry.weight}`)).toEqual([
      'Noto Sans CJK SC|normal|normal',
      'Noto Sans CJK SC|normal|bold',
      'Noto Sans CJK SC|italic|normal',
      'Noto Sans CJK SC|italic|bold',
      'Noto Sans Mono CJK SC|normal|normal',
      'Noto Sans Mono CJK SC|normal|bold',
      'Noto Sans Mono CJK SC|italic|normal',
      'Noto Sans Mono CJK SC|italic|bold',
    ]);
    // Bold must resolve to the bold face, and the full name must carry the weight.
    const boldEntry = plan.find((entry) => entry.weight === 'bold' && entry.fontFamily === 'Noto Sans CJK SC');
    expect(boldEntry?.faceName).toBe('Noto Sans CJK SC Bold');
    expect(boldEntry?.sourceFile).toBe('NotoSansCJK-Bold.ttc');
  });

  it('ignores families that font-mappings.xml never references', async () => {
    const dir = tempDir();
    const latin = await discovered(dir, 'NotoSerif-Regular.ttc', [
      { family: 'Noto Serif', subFamily: 'Regular', postScript: 'NotoSerif-Regular' },
    ]);
    expect(planNotoFopFonts([latin])).toEqual([]);
  });

  it('maps size and regional variants onto the canonical family', async () => {
    const dir = tempDir();
    const light = await discovered(dir, 'NotoSansCJK-Light.ttc', [
      { family: 'Noto Sans CJK SC', subFamily: 'Light', postScript: 'NotoSansCJKsc-Light' },
    ]);
    const plan = planNotoFopFonts([light]);
    // A single Light face still covers all four triplets: FOP bolds and italicises by substitution,
    // which is always better than leaving the family unregistered (a Latin-only fallback).
    expect(plan).toHaveLength(4);
    expect(plan.every((entry) => entry.faceName === 'Noto Sans CJK SC Light')).toBe(true);
  });
});

describe('materializeNotoFopFonts', () => {
  it('writes standalone faces and points the entries at them', async () => {
    const fontDir = tempDir();
    const cacheDir = path.join(tempDir(), 'cache');
    writeFileSync(
      path.join(fontDir, 'NotoSansCJK-Regular.ttc'),
      buildCollection([SC_REGULAR, MONO_SC_REGULAR]),
    );
    writeFileSync(path.join(fontDir, 'NotoSansCJK-Bold.ttc'), buildCollection([SC_BOLD]));
    const files = await discoverNotoCjkFontFiles(fontDir);
    expect(files.map((file) => file.file)).toEqual([
      'NotoSansCJK-Bold.ttc',
      'NotoSansCJK-Regular.ttc',
    ]);
    const targetDir = path.join(tempDir(), 'fonts');
    const entries = await materializeNotoFopFonts({
      fontDir,
      targetDir,
      files,
      plan: planNotoFopFonts(files),
      cacheDir,
    });
    const names = entries.map((entry) => `${entry.family}|${entry.style}|${entry.weight}|${entry.file}`);
    expect(names).toContain('Noto Sans CJK SC|normal|bold|noto-sans-cjk-sc-bold.otf');
    expect(names).toContain('Noto Sans CJK SC|normal|normal|noto-sans-cjk-sc.otf');
    for (const entry of entries) {
      expect(entry.subFont).toBeNull();
      const faces = await readFontFaceNames(path.join(targetDir, entry.file));
      expect(faces[0]?.fullName).toBeTruthy();
    }
    // Second run reuses the cache instead of re-extracting.
    const again = await materializeNotoFopFonts({
      fontDir,
      targetDir,
      files,
      plan: planNotoFopFonts(files),
      cacheDir,
    });
    expect(again).toEqual(entries);
  });

  it('returns nothing when the font directory holds no Noto CJK files', async () => {
    const fontDir = tempDir();
    writeFileSync(path.join(fontDir, 'readme.txt'), 'no fonts here');
    const files = await discoverNotoCjkFontFiles(fontDir);
    expect(files).toEqual([]);
    expect(await discoverNotoCjkFontFiles(path.join(fontDir, 'missing'))).toEqual([]);
    expect(
      await materializeNotoFopFonts({
        fontDir,
        targetDir: path.join(fontDir, 'fonts'),
        files,
        plan: planNotoFopFonts(files),
        cacheDir: path.join(fontDir, 'cache'),
      }),
    ).toEqual([]);
  });
});

describe('fontFailureHintKey', () => {
  it('blames fontconfig for the headless AWT failure', () => {
    const log = [
      'java.lang.RuntimeException: Fontconfig head is null, check your fonts or fonts configuration',
      '\tat sun.awt.FontConfiguration.readFontConfigFile(Unknown Source)',
      '\tat org.apache.batik.bridge.DefaultFontFamilyResolver.<clinit>(DefaultFontFamilyResolver.java:86)',
    ].join('\n');
    expect(fontFailureHintKey(log)).toBe('publish.fontconfigError');
  });

  it('blames the font table for FOP embedding failures', () => {
    expect(fontFailureHintKey('Failed to read font file NotoSansCJK-Bold.ttc')).toBe(
      'publish.fontError',
    );
    expect(
      fontFailureHintKey('java.io.IOException: Name does not exist in the TrueType collection: X'),
    ).toBe('publish.fontError');
    expect(fontFailureHintKey("java.io.IOException: 'loca' table not found")).toBe(
      'publish.fontError',
    );
  });

  it('stays quiet for unrelated failures', () => {
    expect(fontFailureHintKey('[DOTX060W] The gloss_dita key is used in an <abbreviated-form>')).toBe(
      null,
    );
    expect(fontFailureHintKey('')).toBe(null);
  });
});

const SAMPLE_ENTRIES: FopFontEntry[] = [
  { file: 'a.otf', family: 'Noto Sans CJK SC', style: 'normal', weight: 'normal', subFont: null },
  {
    file: 'b.otf',
    family: 'Noto Sans CJK SC',
    style: 'normal',
    weight: 'bold',
    subFont: 'Noto Sans CJK SC Bold',
  },
];

describe('fop.xconf rendering', () => {
  const entries = SAMPLE_ENTRIES;

  it('emits one font element per registration and omits sub-font for standalone faces', () => {
    const xml = renderFopFontsSection(entries);
    expect(xml).toContain('<font embed-url="a.otf" kerning="yes">');
    expect(xml).toContain('<font embed-url="b.otf" kerning="yes" sub-font="Noto Sans CJK SC Bold">');
    expect(xml).toContain(
      '<font-triplet name="Noto Sans CJK SC" style="normal" weight="bold"/>',
    );
    expect(renderFopFontsSection([])).toBe('');
  });

  it('replaces the bundled font table but leaves unknown XML untouched', () => {
    const template = '<renderers><renderer mime="application/pdf"><fonts><font embed-url="x.ttc"/></fonts></renderer></renderers>';
    const updated = applyFopFontEntries(template, entries);
    expect(updated).not.toContain('x.ttc');
    expect(updated).toContain('<font embed-url="a.otf" kerning="yes">');
    expect(applyFopFontEntries(template, [])).toBe(template);
    expect(applyFopFontEntries('<renderers/>', entries)).toBe('<renderers/>');
  });

  it('rewrites font-base and escapes XML entities', () => {
    expect(
      applyFontBase('<fop>\n  <font-base>/usr/share/fonts</font-base>\n</fop>', '/tmp/a&b'),
    ).toBe('<fop>\n  <font-base>/tmp/a&amp;b</font-base>\n</fop>');
    expect(applyFontBase('<fop/>', '/tmp')).toBe('<fop/>');
    expect(fontExtensionForVersion(OTTO)).toBe('.otf');
    expect(fontExtensionForVersion(TRUE_TYPE)).toBe('.ttf');
  });

  it('inserts the font table into a renderer that has none', () => {
    const template =
      '<fop>\n  <renderers>\n    <renderer mime="application/pdf">\n    </renderer>\n  </renderers>\n</fop>';
    const updated = applyFopFontEntries(template, entries);
    expect(updated).toContain('<fonts>');
    expect(checkXmlWellFormed(updated).ok).toBe(true);
  });

  it('only rewrites real elements, never element names quoted inside comments', () => {
    const template = [
      '<!--',
      '  The API rewrites the font-base element and the fonts block.',
      '  A comment may also mention <fonts>inline</fonts>.',
      '-->',
      '<fop>',
      '  <font-base>/usr/share/fonts</font-base>',
      '  <renderers><renderer mime="application/pdf">',
      '      <fonts>',
      '        <font embed-url="stale.ttc"/>',
      '      </fonts>',
      '    </renderer></renderers>',
      '</fop>',
    ].join('\n');
    const updated = applyFopFontEntries(applyFontBase(template, '/job/fonts'), entries);
    // Losing the comment terminator makes FOP report `xml parse error` on the job config.
    expect(updated).toContain('-->');
    expect(updated).toContain('A comment may also mention <fonts>inline</fonts>.');
    expect(updated).not.toContain('stale.ttc');
    expect(updated).toContain('<font-base>/job/fonts</font-base>');
    expect(checkXmlWellFormed(updated).ok).toBe(true);
  });
});

describe('bundled fop.xconf template', () => {
  const templatePath = path.resolve(
    __dirname,
    '../../../dita-ot-plugins/com.ditaeditor.pdf-cjk/fop.xconf',
  );

  it('reads as a fallback table for single-face OTF files', async () => {
    const template = await readFile(templatePath, 'utf8');
    expect(checkXmlWellFormed(template).ok).toBe(true);
    // FOP 2.9 cannot embed a collection, so the template must never point at one.
    expect(template).not.toMatch(/embed-url="[^"]*\.(ttc|otc)"/i);
    expect(template).toContain('NotoSansCJKsc-Regular.otf');
  });

  it('stays well-formed after the job-local rewrite', async () => {
    const template = await readFile(templatePath, 'utf8');
    const jobFonts = '/data/publishes/jobs/pub-1/fonts';
    const updated = applyFopFontEntries(applyFontBase(template, jobFonts), SAMPLE_ENTRIES);
    expect(checkXmlWellFormed(updated).ok).toBe(true);
    expect(updated).toContain(`<font-base>${jobFonts}</font-base>`);
    expect(updated).not.toContain('NotoSansCJKsc-Regular.otf');
    expect(updated).toContain('<font embed-url="a.otf" kerning="yes">');
    // Without a discovered face the template is kept, only font-base moves.
    const fallback = applyFopFontEntries(applyFontBase(template, jobFonts), []);
    expect(checkXmlWellFormed(fallback).ok).toBe(true);
    expect(fallback).toContain('NotoSansCJKsc-Regular.otf');
  });
});

describe('discoverNotoCjkFontFiles', () => {
  it('prefers the canonical Regular/Bold pair over extra weights', async () => {
    const dir = tempDir();
    for (const name of [
      'NotoSansCJK-Regular.ttc',
      'NotoSansCJK-Bold.ttc',
      'NotoSansCJK-Light.ttc',
      'NotoSansCJK-Black.ttc',
      'NotoSerifCJK-Regular.ttc',
    ]) {
      writeFileSync(path.join(dir, name), buildCollection([SC_REGULAR]));
    }
    await mkdir(dir, { recursive: true });
    const files = await discoverNotoCjkFontFiles(dir);
    expect(files.map((file) => file.file)).toEqual([
      'NotoSansCJK-Bold.ttc',
      'NotoSansCJK-Regular.ttc',
      'NotoSerifCJK-Regular.ttc',
    ]);
  });
});
