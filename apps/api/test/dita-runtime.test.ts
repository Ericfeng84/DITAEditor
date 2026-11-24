import { describe, expect, it } from 'vitest';
import { resolveDitaSpawn } from '../src/modules/dita-ot/dita-runtime.js';

describe('resolveDitaSpawn', () => {
  it('spawns directly without a shell on POSIX platforms', () => {
    const spec = resolveDitaSpawn('/opt/dita-ot/bin/dita', ['--version'], 'darwin');
    expect(spec).toEqual({
      file: '/opt/dita-ot/bin/dita',
      args: ['--version'],
    });
  });

  it('wraps .bat invocations on Windows through cmd.exe with quoted paths', () => {
    const spec = resolveDitaSpawn(
      'C:\\Program Files\\dita-ot\\bin\\dita.bat',
      ['--input=C:\\Users\\Alice Smith\\manual.ditamap', '--format=pdf'],
      'win32',
    );
    expect(spec.windowsVerbatimArguments).toBe(true);
    expect(spec.args.slice(0, 3)).toEqual(['/d', '/s', '/c']);
    expect(spec.args[3]).toBe(
      '""C:\\Program Files\\dita-ot\\bin\\dita.bat" "--input=C:\\Users\\Alice Smith\\manual.ditamap" --format=pdf"',
    );
  });

  it('wraps bare dita command on Windows', () => {
    const spec = resolveDitaSpawn('dita', ['--version'], 'win32');
    expect(spec.windowsVerbatimArguments).toBe(true);
    expect(spec.args[3]).toBe('"dita --version"');
  });

  it('does not wrap native .exe executables on Windows', () => {
    const spec = resolveDitaSpawn('C:\\tools\\dita.exe', ['--version'], 'win32');
    expect(spec).toEqual({
      file: 'C:\\tools\\dita.exe',
      args: ['--version'],
    });
  });
});
