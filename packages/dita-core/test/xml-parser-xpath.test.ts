import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type * as slimdom from 'slimdom';
import { describe, expect, it } from 'vitest';
import {
  checkXmlWellFormed,
  evaluateXPathToFirstNode,
  evaluateXPathToStrings,
  findConrefUsages,
  findElementByDitaId,
  findKeyrefUsages,
  getNodeSourceRange,
  parseXml,
} from '../src/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, 'fixtures');

describe('slimdom-sax-parser position tracking, well-formedness guard, and fontoxpath', () => {
  it('tracks accurate source line/column/offset ranges on parsed slimdom nodes', () => {
    const xml = readFileSync(join(FIXTURES_DIR, '01-concept-basics.dita'), 'utf8');
    const { document } = parseXml(xml, { position: true });

    const titleEl = evaluateXPathToFirstNode<slimdom.Element>('/concept/title', document)!;
    const range = getNodeSourceRange(titleEl);

    expect(range.open).toBeDefined();
    expect(range.open!.line).toBe(4);
    expect(range.close).toBeDefined();
    expect(range.close!.end).toBeGreaterThan(range.open!.start);
  });

  it('rejects malformed XML with accurate line/column error for Source -> Visual guard', () => {
    const malformedXml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<topic id="broken">',
      '  <title>Broken Topic</title>',
      '  <body>',
      '    <p>Unclosed paragraph',
      '  </body>',
      '</topic>',
    ].join('\n');

    const result = checkXmlWellFormed(malformedXml);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.line).toBe(6);
      expect(result.error.column).toBeGreaterThan(0);
      expect(result.error.message).toMatch(/unexpected close tag/i);
    }
  });

  it('queries DITA IDs, keyrefs, conrefs, and conkeyrefs via fontoxpath XPath 3.1', () => {
    const xml = readFileSync(join(FIXTURES_DIR, '05-keys-conref-conkeyref.dita'), 'utf8');
    const { document } = parseXml(xml);

    // DITA #topicId/elemId resolution
    const reusableP = findElementByDitaId(document, 'task_single_sourcing', 'reusable_info');
    expect(reusableP).not.toBeNull();
    expect(reusableP!.tagName).toBe('p');

    // keyref extraction
    const keyrefs = findKeyrefUsages(document);
    expect(keyrefs.map((k) => k.keyref)).toEqual([
      'product_name',
      'release_version',
      'product_name',
      'upgrade_cli_ref',
      'backup_dir',
    ]);

    // conref & conkeyref extraction
    const conrefs = findConrefUsages(document);
    expect(conrefs.map((c) => `${c.attrName}:${c.value}`)).toEqual([
      'conref:shared/warnings.dita#warnings/backup_before_upgrade',
      'conkeyref:common_lists/prereq_start',
      'conkeyref:common_steps/login_admin',
      'conref:#task_single_sourcing/reusable_info',
    ]);
    expect(conrefs[1]!.conrefend).toBe('common_lists/prereq_end');

    // Arbitrary XPath 3.1 expression
    const audiences = evaluateXPathToStrings('//@audience', document);
    expect(audiences).toEqual(['admin', 'admin']);
  });
});
