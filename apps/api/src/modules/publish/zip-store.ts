import { createWriteStream } from 'node:fs';
import { readFile, readdir, stat } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

export function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date: Date): { time: number; date: number } {
  const year = Math.max(1980, date.getFullYear());
  return {
    time:
      (date.getHours() << 11) |
      (date.getMinutes() << 5) |
      Math.floor(date.getSeconds() / 2),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

async function listFiles(rootDir: string, include?: (relPath: string) => boolean): Promise<string[]> {
  const files: string[] = [];
  const walk = async (dir: string) => {
    const entries = await readdir(dir, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const absPath = join(dir, entry.name);
      const relPath = relative(rootDir, absPath).split(sep).join('/');
      if (include && !include(relPath)) continue;
      if (entry.isDirectory()) {
        await walk(absPath);
      } else if (entry.isFile()) {
        files.push(absPath);
      }
    }
  };
  await walk(rootDir);
  return files;
}

function writeBuffer(
  stream: NodeJS.WritableStream,
  buffer: Buffer,
): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const onError = (err: Error) => reject(err);
    stream.once('error', onError);
    const done = () => {
      stream.off('error', onError);
      resolvePromise();
    };
    if (stream.write(buffer)) {
      done();
    } else {
      stream.once('drain', done);
    }
  });
}

/**
 * Store-only ZIP writer. HTML5 output is mostly text and images that DITA-OT already
 * compressed where useful; keeping the implementation dependency-free is more valuable
 * than squeezing a few percent off the archive.
 */
export async function createZipFromDirectory(
  sourceDir: string,
  zipPath: string,
  options: { include?: (relPath: string) => boolean } = {},
): Promise<{ entries: number; bytes: number }> {
  const files = await listFiles(sourceDir, options.include);
  const stream = createWriteStream(zipPath);
  const central: Buffer[] = [];
  let offset = 0;
  let totalBytes = 0;

  try {
    for (const absPath of files) {
      const [content, info] = await Promise.all([readFile(absPath), stat(absPath)]);
      const name = Buffer.from(
        relative(sourceDir, absPath).split(sep).join('/'),
        'utf8',
      );
      const checksum = crc32(content);
      const { time, date } = dosDateTime(info.mtime);

      const local = Buffer.alloc(30);
      local.writeUInt32LE(0x04034b50, 0);
      local.writeUInt16LE(20, 4);
      local.writeUInt16LE(0x0800, 6);
      local.writeUInt16LE(0, 8);
      local.writeUInt16LE(time, 10);
      local.writeUInt16LE(date, 12);
      local.writeUInt32LE(checksum, 14);
      local.writeUInt32LE(content.length, 18);
      local.writeUInt32LE(content.length, 22);
      local.writeUInt16LE(name.length, 26);
      local.writeUInt16LE(0, 28);

      await writeBuffer(stream, local);
      await writeBuffer(stream, name);
      await writeBuffer(stream, content);

      const entry = Buffer.alloc(46);
      entry.writeUInt32LE(0x02014b50, 0);
      entry.writeUInt16LE(20, 4);
      entry.writeUInt16LE(20, 6);
      entry.writeUInt16LE(0x0800, 8);
      entry.writeUInt16LE(0, 10);
      entry.writeUInt16LE(time, 12);
      entry.writeUInt16LE(date, 14);
      entry.writeUInt32LE(checksum, 16);
      entry.writeUInt32LE(content.length, 20);
      entry.writeUInt32LE(content.length, 24);
      entry.writeUInt16LE(name.length, 28);
      entry.writeUInt16LE(0, 30);
      entry.writeUInt16LE(0, 32);
      entry.writeUInt16LE(0, 34);
      entry.writeUInt16LE(0, 36);
      entry.writeUInt32LE(0, 38);
      entry.writeUInt32LE(offset, 42);
      central.push(entry, name);

      offset += local.length + name.length + content.length;
      totalBytes += content.length;
    }

    const centralOffset = offset;
    for (const chunk of central) {
      await writeBuffer(stream, chunk);
      offset += chunk.length;
    }
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(0, 4);
    end.writeUInt16LE(0, 6);
    end.writeUInt16LE(files.length, 8);
    end.writeUInt16LE(files.length, 10);
    end.writeUInt32LE(offset - centralOffset, 12);
    end.writeUInt32LE(centralOffset, 16);
    end.writeUInt16LE(0, 20);
    await writeBuffer(stream, end);

    await new Promise<void>((resolvePromise, reject) => {
      stream.end(() => resolvePromise());
      stream.once('error', reject);
    });
  } catch (err) {
    stream.destroy();
    throw err;
  }

  return { entries: files.length, bytes: totalBytes };
}
