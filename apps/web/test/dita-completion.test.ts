import { describe, expect, it } from 'vitest';
import { CompletionContext } from '@codemirror/autocomplete';
import { EditorState } from '@codemirror/state';
import {
  ditaXmlCompletionSource,
  findEnclosingXmlTag,
} from '../src/editor/source/dita-completion';

function completeAtEnd(xmlSnippet: string, explicit = true) {
  const state = EditorState.create({ doc: xmlSnippet });
  const ctx = new CompletionContext(state, xmlSnippet.length, explicit);
  return ditaXmlCompletionSource(ctx);
}

describe('CodeMirror 6 DITA 1.3 XML Autocomplete', () => {
  it('detects the innermost open parent tag ignoring comments and self-closing tags', () => {
    const xml = `<task id="t1"><!-- <ignored> --><taskbody><steps><step><cmd>Run <keyword keyref="k1"/> `;
    expect(findEnclosingXmlTag(xml)).toBe('cmd');
  });

  it('suggests only legal child elements inside <steps>', () => {
    const res = completeAtEnd('<task id="t"><taskbody><steps><');
    expect(res).not.toBeNull();
    const labels = res!.options.map((o) => o.label);
    expect(labels).toEqual(['step']);
  });

  it('suggests closing tag matching the open parent element', () => {
    const res = completeAtEnd('<concept id="c"><conbody><section><title>Hi</');
    expect(res).not.toBeNull();
    expect(res!.options[0]?.label).toBe('title');
  });

  it('suggests DITA element attributes and enumerated values', () => {
    const attrNames = completeAtEnd('<note ty');
    expect(attrNames).not.toBeNull();
    expect(attrNames!.options.some((o) => o.label === 'type')).toBe(true);

    const attrValues = completeAtEnd('<note type="');
    expect(attrValues).not.toBeNull();
    const values = attrValues!.options.map((o) => o.label);
    expect(values).toContain('tip');
    expect(values).toContain('warning');
    expect(values).toContain('danger');
  });

  it('suggests legal Map / Bookmap child tags and topicref attributes', () => {
    const mapChildren = completeAtEnd('<map id="m1"><');
    expect(mapChildren).not.toBeNull();
    const mapTags = mapChildren!.options.map((o) => o.label);
    expect(mapTags).toContain('topicref');
    expect(mapTags).toContain('mapref');
    expect(mapTags).toContain('topichead');
    expect(mapTags).toContain('keydef');

    const bookChildren = completeAtEnd('<bookmap id="b1"><');
    const bookTags = bookChildren!.options.map((o) => o.label);
    expect(bookTags).toContain('chapter');
    expect(bookTags).toContain('part');
    expect(bookTags).toContain('appendix');

    const topicrefAttrs = completeAtEnd('<topicref proc');
    expect(topicrefAttrs!.options.some((o) => o.label === 'processing-role')).toBe(true);
  });
});
