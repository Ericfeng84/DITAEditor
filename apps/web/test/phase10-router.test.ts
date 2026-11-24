import { describe, expect, it } from 'vitest';
import { editorPath, hubPath, parseRoute } from '../src/router/app-router.js';

/**
 * Phase 10 slice 10.3 — the hub ⇄ editor URL contract.
 *
 * These paths are user-visible (deep links from assignment cards, browser history) so the
 * parser and the builders are tested together and must round-trip.
 */
describe('Phase 10 app router', () => {
  it('treats the root and unknown paths as the manual hub', () => {
    expect(parseRoute('http://dita.local/')).toEqual({ name: 'hub' });
    expect(parseRoute('http://dita.local/somewhere/else')).toEqual({ name: 'hub' });
    expect(parseRoute('http://dita.local/manuals/')).toEqual({ name: 'hub' });
    expect(parseRoute('not a url at all')).toEqual({ name: 'hub' });
  });

  it('parses an editor session with branch, topic and assignment query params', () => {
    const route = parseRoute(
      'http://dita.local/manuals/demo-manual?branch=release%2F2.0&topic=topics%2Fintro.dita&assignment=a-1',
    );
    expect(route).toEqual({
      name: 'editor',
      manualId: 'demo-manual',
      branch: 'release/2.0',
      topicPath: 'topics/intro.dita',
      assignmentId: 'a-1',
    });
  });

  it('drops blank query params instead of surfacing empty strings', () => {
    const route = parseRoute('http://dita.local/manuals/m1?branch=&topic=%20&assignment=');
    expect(route).toEqual({
      name: 'editor',
      manualId: 'm1',
      branch: null,
      topicPath: null,
      assignmentId: null,
    });
  });

  it('round-trips the paths it builds', () => {
    const url = editorPath('m 1', {
      branch: 'release/2.0',
      topicPath: 'topics/a b.dita',
      assignmentId: 'asg-9',
    });
    const parsed = new URL(url, 'http://dita.local');
    expect(parseRoute(parsed.toString())).toEqual({
      name: 'editor',
      manualId: 'm 1',
      branch: 'release/2.0',
      topicPath: 'topics/a b.dita',
      assignmentId: 'asg-9',
    });
    expect(parseRoute(new URL(hubPath(), 'http://dita.local').toString())).toEqual({ name: 'hub' });
  });
});
