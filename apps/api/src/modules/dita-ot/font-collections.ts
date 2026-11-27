/**
 * Minimal sfnt (`name` table + table directory) reader for OpenType files and TTC/OTC
 * collections, plus a face extractor.
 *
 * Two FOP 2.9 facts drive this module:
 * 1. `sub-font` is matched against a face's *full name* (name table ID 4) with an exact string
 *    comparison, and that name changes per weight — `NotoSansCJK-Regular.ttc` contains
 *    `Noto Sans CJK SC`, `NotoSansCJK-Bold.ttc` contains `Noto Sans CJK SC Bold`. Hard-coding
 *    either spelling fails on other font builds with
 *    `Name does not exist in the TrueType collection: ...`.
 * 2. `OFFontLoader` chooses its parser from the first four bytes of the file: only a literal
 *    `OTTO` header becomes an `OTFFile`. Everything else — a `ttcf` collection included — goes
 *    through `TTFFile`, which demands `glyf`/`loca` and aborts with `'loca' table not found` on
 *    CFF-outline collections such as Debian's Noto CJK `*.ttc`.
 * So an embedded CJK font must be materialised as a standalone face. `extractFontFace()` does
 * that by copying one face's tables into a fresh sfnt container with recomputed offsets.
 */
import { open, writeFile, type FileHandle } from 'node:fs/promises';

const TTC_TAG = 0x74746366; // 'ttcf'
const NAME_TAG = 0x6e616d65; // 'name'
const SFNT_VERSION_1 = 0x00010000;
const SFNT_VERSION_TRUE = 0x74727565; // 'true'
const SFNT_VERSION_OTTO = 0x4f54544f; // 'OTTO'
const MAX_TTC_FACES = 256;
const MAX_TABLES = 512;
const MAX_NAME_TABLE_BYTES = 1 << 20;
const MAX_FONT_BYTES = 256 * 1024 * 1024;

/** The `name` table records FOP needs to address one face of a font file. */
export interface FontFaceNames {
  familyName: string;
  subFamilyName: string;
  /** Name ID 4 — the value FOP's `sub-font` attribute must match exactly. */
  fullName: string;
  postScriptName: string;
}

/** One entry of an sfnt table directory. `offset` is absolute inside the file. */
export interface FontTableRecord {
  tag: string;
  checksum: number;
  offset: number;
  length: number;
}

/** A single face: its names, outline flavour and table directory. */
export interface FontFaceInfo {
  names: FontFaceNames;
  sfntVersion: number;
  tables: FontTableRecord[];
}

/** Reads the face names of an sfnt file (one face) or a TTC/OTC collection (one per face). */
export async function readFontFaceNames(absPath: string): Promise<FontFaceNames[]> {
  const faces = await readFontFaces(absPath);
  return faces.map((face) => face.names);
}

/** Reads every face of a font file together with its table directory. */
export async function readFontFaces(absPath: string): Promise<FontFaceInfo[]> {
  let handle: FileHandle;
  try {
    handle = await open(absPath, 'r');
  } catch {
    return [];
  }
  try {
    const { size } = await handle.stat();
    if (size < 12) return [];
    const reader = new FontByteReader(handle, size);
    const offsets = await readFaceOffsets(reader);
    const faces: FontFaceInfo[] = [];
    for (const offset of offsets) {
      const face = await readFace(reader, offset);
      if (face) faces.push(face);
    }
    return faces;
  } catch {
    // Unreadable or truncated font files must never break publishing: the caller falls back to
    // the bundled fop.xconf defaults.
    return [];
  } finally {
    await handle.close();
  }
}

/**
 * Writes the face whose full name is `faceFullName` as a standalone sfnt file at `targetPath`.
 *
 * @returns `true` when the face was written, `false` when it is missing or the source is
 * unreadable. Never throws for font-content reasons.
 */
export async function extractFontFace(
  absPath: string,
  faceFullName: string,
  targetPath: string,
): Promise<boolean> {
  let handle: FileHandle;
  try {
    handle = await open(absPath, 'r');
  } catch {
    return false;
  }
  try {
    const { size } = await handle.stat();
    if (size < 12) return false;
    const reader = new FontByteReader(handle, size);
    const offsets = await readFaceOffsets(reader);
    for (const offset of offsets) {
      const face = await readFace(reader, offset);
      if (!face || face.names.fullName !== faceFullName) continue;
      const packed = await packFace(reader, face);
      if (!packed) return false;
      await writeFile(targetPath, packed);
      return true;
    }
    return false;
  } catch {
    return false;
  } finally {
    await handle.close();
  }
}

/** Extension implied by the outline format of a face. */
export function fontExtensionForVersion(sfntVersion: number): '.otf' | '.ttf' {
  return sfntVersion === SFNT_VERSION_OTTO ? '.otf' : '.ttf';
}

async function packFace(reader: FontByteReader, face: FontFaceInfo): Promise<Buffer | null> {
  const records = [...face.tables].sort((left, right) =>
    left.tag < right.tag ? -1 : left.tag > right.tag ? 1 : 0,
  );
  if (records.length === 0 || records.length > MAX_TABLES) return null;
  let cursor = 12 + records.length * 16;
  const chunks: Buffer[] = [];
  const placed: FontTableRecord[] = [];
  for (const record of records) {
    if (record.length <= 0 || record.offset + record.length > reader.size) return null;
    const data = await reader.read(record.offset, record.length);
    placed.push({ ...record, offset: cursor });
    chunks.push(data);
    const padding = (4 - (record.length % 4)) % 4;
    if (padding > 0) chunks.push(Buffer.alloc(padding));
    cursor += record.length + padding;
    if (cursor > MAX_FONT_BYTES) return null;
  }
  const directory = Buffer.alloc(12 + placed.length * 16);
  let entrySelector = 0;
  while (2 ** (entrySelector + 1) <= placed.length) entrySelector += 1;
  const searchRange = 16 * 2 ** entrySelector;
  directory.writeUInt32BE(face.sfntVersion, 0);
  directory.writeUInt16BE(placed.length, 4);
  directory.writeUInt16BE(searchRange, 6);
  directory.writeUInt16BE(entrySelector, 8);
  directory.writeUInt16BE(placed.length * 16 - searchRange, 10);
  placed.forEach((record, index) => {
    const entry = 12 + index * 16;
    directory.write(record.tag, entry, 4, 'latin1');
    directory.writeUInt32BE(record.checksum, entry + 4);
    directory.writeUInt32BE(record.offset, entry + 8);
    directory.writeUInt32BE(record.length, entry + 12);
  });
  return Buffer.concat([directory, ...chunks]);
}

async function readFaceOffsets(reader: FontByteReader): Promise<number[]> {
  const header = await reader.read(0, 12);
  const tag = header.readUInt32BE(0);
  if (tag !== TTC_TAG) {
    if (tag !== SFNT_VERSION_1 && tag !== SFNT_VERSION_TRUE && tag !== SFNT_VERSION_OTTO) return [];
    return [0];
  }
  const numFonts = header.readUInt32BE(8);
  if (numFonts === 0 || numFonts > MAX_TTC_FACES) return [];
  const offsets: number[] = [];
  const table = await reader.read(12, numFonts * 4);
  for (let index = 0; index < numFonts; index += 1) {
    const offset = table.readUInt32BE(index * 4);
    if (offset > 0 && offset + 12 <= reader.size) offsets.push(offset);
  }
  return offsets;
}

async function readFace(reader: FontByteReader, faceOffset: number): Promise<FontFaceInfo | null> {
  const header = await reader.read(faceOffset, 12);
  const sfntVersion = header.readUInt32BE(0);
  const numTables = header.readUInt16BE(4);
  if (numTables === 0 || numTables > MAX_TABLES) return null;
  const directory = await reader.read(faceOffset + 12, numTables * 16);
  const tables: FontTableRecord[] = [];
  for (let index = 0; index < numTables; index += 1) {
    const entry = index * 16;
    tables.push({
      tag: directory.toString('latin1', entry, entry + 4),
      checksum: directory.readUInt32BE(entry + 4),
      // Inside a collection every face has its own table directory but the table offsets stay
      // absolute file offsets (OpenType spec, "Font Collections"); a standalone face starts at
      // 0, so adding `faceOffset` would only break TTCs.
      offset: directory.readUInt32BE(entry + 8),
      length: directory.readUInt32BE(entry + 12),
    });
  }
  const nameTable = tables.find((table) => table.tag === 'name');
  if (!nameTable || nameTable.length < 6 || nameTable.length > MAX_NAME_TABLE_BYTES) return null;
  const available = Math.min(nameTable.length, reader.size - nameTable.offset);
  if (available < 6) return null;
  const names = parseNameTable(await reader.read(nameTable.offset, available));
  if (!names) return null;
  return { names, sfntVersion, tables };
}

interface NameRecord {
  nameId: number;
  platformId: number;
  encodingId: number;
  languageId: number;
  value: string;
}

function parseNameTable(table: Buffer): FontFaceNames | null {
  const count = table.readUInt16BE(2);
  const stringOffset = table.readUInt16BE(4);
  const records: NameRecord[] = [];
  for (let index = 0; index < count; index += 1) {
    const record = 6 + index * 12;
    if (record + 12 > table.length) break;
    const platformId = table.readUInt16BE(record);
    const encodingId = table.readUInt16BE(record + 2);
    const languageId = table.readUInt16BE(record + 4);
    const nameId = table.readUInt16BE(record + 6);
    const length = table.readUInt16BE(record + 8);
    const offset = table.readUInt16BE(record + 10);
    const start = stringOffset + offset;
    const end = start + length;
    if (start < 0 || end > table.length || end <= start) continue;
    const value = decodeName(table.subarray(start, end), platformId, encodingId);
    if (value) records.push({ nameId, platformId, encodingId, languageId, value });
  }
  const pick = (nameId: number): string =>
    bestRecord(records.filter((record) => record.nameId === nameId))?.value ?? '';
  const familyName = pick(1) || pick(16);
  const subFamilyName = pick(2) || pick(17);
  const fullName = pick(4) || [familyName, subFamilyName].filter(Boolean).join(' ');
  const postScriptName = pick(6);
  if (!fullName) return null;
  return { familyName, subFamilyName, fullName, postScriptName };
}

function decodeName(bytes: Buffer, platformId: number, encodingId: number): string {
  const text =
    platformId === 1 && encodingId === 0
      ? bytes.toString('latin1')
      : platformId === 3 && encodingId === 10
        ? decodeUtf32Be(bytes)
        : platformId === 0 || platformId === 3
          ? decodeUtf16Be(bytes)
          : '';
  return text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim();
}

function decodeUtf16Be(bytes: Buffer): string {
  let text = '';
  for (let index = 0; index + 1 < bytes.length; index += 2) {
    text += String.fromCharCode(bytes.readUInt16BE(index));
  }
  return text;
}

function decodeUtf32Be(bytes: Buffer): string {
  let text = '';
  for (let index = 0; index + 3 < bytes.length; index += 4) {
    text += String.fromCodePoint(bytes.readUInt32BE(index));
  }
  return text;
}

/** FOP itself prefers the Windows Unicode (3/1) English record; mirror that ordering. */
function bestRecord(records: NameRecord[]): NameRecord | undefined {
  const scored = records.map((record) => ({ record, score: scoreNameRecord(record) }));
  scored.sort((left, right) => right.score - left.score);
  return scored[0]?.record;
}

function scoreNameRecord(record: NameRecord): number {
  const { platformId, encodingId, languageId } = record;
  // (3,1,0x409) is the canonical Windows Unicode US-English record; the rest are fallbacks
  // for fonts that only ship legacy Macintosh or localized records.
  if (platformId === 3 && (encodingId === 1 || encodingId === 10)) {
    return languageId === 0x409 ? 100 : 80;
  }
  if (platformId === 0) return 60;
  if (platformId === 1 && encodingId === 0) return languageId === 0 ? 50 : 40;
  return 10;
}

class FontByteReader {
  constructor(
    private readonly handle: FileHandle,
    readonly size: number,
  ) {}

  async read(position: number, length: number): Promise<Buffer> {
    const clamped = Math.min(length, this.size - position);
    if (position < 0 || clamped <= 0) throw new RangeError('font read out of bounds');
    const buffer = Buffer.alloc(clamped);
    let read = 0;
    while (read < clamped) {
      const result = await this.handle.read(buffer, read, clamped - read, position + read);
      if (result.bytesRead === 0) break;
      read += result.bytesRead;
    }
    if (read !== clamped) buffer.fill(0, read);
    return buffer;
  }
}
