import { beforeEach, describe, expect, it } from 'vitest';
import {
  checkXmlStructure,
  detectTaskContentModel,
  getInsertableTagsBySequence,
  validateChildSequence,
  xmlToPmDoc,
} from '@dita/core';
import {
  getTaskContentModel,
  getTaskContentModelSetting,
  resolveTaskModelForDocument,
  resolveTaskModelForXml,
  setDetectedTaskContentModel,
  setTaskContentModelSetting,
  shouldShowTaskModelSwitch,
} from '../src/editor/structure-options';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { EditorTabBar } from '../src/components/EditorTabBar';
import { TaskModelSwitch } from '../src/components/TaskModelSwitch';
import {
  selectActiveTab,
  useEditorStore,
  type EditorViewMode,
  type OpenEditorTab,
} from '../src/store/editor-store';
import { describeStructureIssue } from '../src/editor/structure-messages';

const GENERAL_TASK_XML = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE task PUBLIC "-//OASIS//DTD DITA General Task//EN" "generalTask.dtd">
<task id="general_task">
  <title>General Task</title>
  <taskbody>
    <prereq>First prerequisite.</prereq>
    <context>Interleaved context.</context>
    <section>
      <title>Overview</title>
      <p>General tasks allow sections.</p>
    </section>
    <prereq>A second prerequisite is legal here.</prereq>
  </taskbody>
</task>
`;

function makeTab(
  path: string,
  docType: OpenEditorTab['docType'],
  xml: string,
): OpenEditorTab {
  return {
    path,
    fileName: path.split('/').pop() ?? path,
    title: path,
    kind: 'topic',
    docType,
    baselineXml: xml,
    xml: xml,
    mode: 'visual' as EditorViewMode,
    xmlError: null,
    switchBlockedReason: null,
    visualReloadToken: 0,
  } satisfies OpenEditorTab;
}

const STRICT_TASK_XML = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE task PUBLIC "-//OASIS//DTD DITA Task//EN" "task.dtd">
<task id="strict_task">
  <title>Strict Task</title>
  <taskbody>
    <prereq>Only one prerequisite.</prereq>
  </taskbody>
</task>
`;

/**
 * The task content-model switch (`auto` / `strict` / `general`) is a UI preference backed by a
 * module-level mirror, so commands, block transforms, the Source linter and XML autocomplete switch
 * without re-creating the editors.
 */
describe('task content model switch', () => {
  beforeEach(() => {
    setTaskContentModelSetting('auto');
    setDetectedTaskContentModel('strict');
    useEditorStore.getState().setTaskModelSetting('auto');
  });

  it('mirrors the store preference into the React-free helper with a status message', () => {
    expect(useEditorStore.getState().taskModelSetting).toBe('auto');
    expect(getTaskContentModelSetting()).toBe('auto');

    useEditorStore.getState().setTaskModelSetting('general');
    expect(useEditorStore.getState().taskModelSetting).toBe('general');
    expect(getTaskContentModelSetting()).toBe('general');
    expect(useEditorStore.getState().statusMessage).not.toBe('');
  });

  it('resolves `auto` from the document DOCTYPE and honours a forced variant', () => {
    expect(resolveTaskModelForXml(GENERAL_TASK_XML)).toBe('general');
    expect(resolveTaskModelForXml(STRICT_TASK_XML)).toBe('strict');

    setTaskContentModelSetting('strict');
    expect(resolveTaskModelForXml(GENERAL_TASK_XML)).toBe('strict');

    setTaskContentModelSetting('general');
    expect(resolveTaskModelForXml(STRICT_TASK_XML)).toBe('general');
  });

  it('uses the detected document model for document-less helpers', () => {
    setDetectedTaskContentModel('general');
    expect(getTaskContentModel()).toBe('general');
    setTaskContentModelSetting('strict');
    expect(getTaskContentModel()).toBe('strict');
  });

  it('keeps a generalTask document structure-clean and a strictTask document strict', () => {
    expect(checkXmlStructure(GENERAL_TASK_XML, { taskModel: 'auto' })).toMatchObject({
      ok: true,
      issues: [],
    });
    const forced = checkXmlStructure(GENERAL_TASK_XML, { taskModel: 'strict' });
    expect(forced.ok && forced.issues.map((issue) => issue.childTag)).toEqual([
      'section',
      'prereq',
    ]);
    expect(checkXmlStructure(STRICT_TASK_XML, { taskModel: 'auto' })).toMatchObject({
      ok: true,
      issues: [],
    });
  });

  it('adds the general-only children to the insert candidates only in general mode', () => {
    const candidates = ['section', 'steps-informal', 'result', 'postreq'];
    expect(getInsertableTagsBySequence('taskbody', [], candidates)).toEqual(['result', 'postreq']);
    expect(getInsertableTagsBySequence('taskbody', [], candidates, 'general')).toContain('section');
    expect(getInsertableTagsBySequence('taskbody', [], candidates, 'general')).toContain(
      'steps-informal',
    );
    expect(validateChildSequence('taskbody', ['section'])).toHaveLength(1);
    expect(validateChildSequence('taskbody', ['section'], { taskModel: 'general' })).toEqual([]);
  });

  it('explains the strict-only rejection in both locales', () => {
    const zh = describeStructureIssue(
      { code: 'child-not-allowed', parentTag: 'taskbody', childTag: 'section' },
      'zh-CN',
    );
    const en = describeStructureIssue(
      { code: 'child-not-allowed', parentTag: 'taskbody', childTag: 'section' },
      'en',
    );
    expect(zh).toContain('<section>');
    expect(zh).toContain('<taskbody>');
    expect(zh).toContain('generalTask.dtd');
    expect(en).toContain('<section>');
    expect(en).toContain('strict task model');
  });

  it('shows the switch for task documents only', () => {
    expect(shouldShowTaskModelSwitch('task')).toBe(true);
    expect(shouldShowTaskModelSwitch('concept')).toBe(false);
    expect(shouldShowTaskModelSwitch('reference')).toBe(false);
    expect(shouldShowTaskModelSwitch('topic')).toBe(false);
    expect(shouldShowTaskModelSwitch('map')).toBe(false);
    expect(shouldShowTaskModelSwitch(null)).toBe(false);
    expect(shouldShowTaskModelSwitch(undefined)).toBe(false);

    // The tab bar no longer hosts the control; the visual sub-header and the source toolbar do.
    const tabBarMarkup = renderToStaticMarkup(
      createElement(EditorTabBar, {
        tabs: [makeTab('concepts/task-j048.dita', 'task', STRICT_TASK_XML)],
        activeTabPath: 'concepts/task-j048.dita',
        onSelectTab: () => {},
        onCloseTab: () => {},
        onCloseOtherTabs: () => {},
        onCloseSavedTabs: () => {},
      }),
    );
    expect(tabBarMarkup).toContain('task-j048.dita');
    expect(tabBarMarkup).not.toContain('task-model-select');
  });

  it('renders all three variants and adapts to the light and dark toolbars', () => {
    const auto = renderToStaticMarkup(
      createElement(TaskModelSwitch, {
        setting: 'auto',
        resolved: 'general',
        onChange: () => {},
      }),
    );
    expect(auto).toContain('value="auto"');
    expect(auto).toContain('value="strict"');
    expect(auto).toContain('value="general"');
    expect(auto).toContain('dita-task-model--light');
    // The resolved hint text follows the active UI locale (SSR defaults to English here).
    expect(auto).toMatch(/data-testid="task-model-resolved">[^<]+</);

    const dark = renderToStaticMarkup(
      createElement(TaskModelSwitch, {
        setting: 'general',
        resolved: 'general',
        variant: 'dark',
        onChange: () => {},
      }),
    );
    expect(dark).toContain('dita-task-model--dark');
    expect(dark).not.toContain('data-testid="task-model-resolved"');
  });

  it('detects the variant of the active tab through the shared helper', () => {
    expect(detectTaskContentModel(GENERAL_TASK_XML)).toBe('general');
    const active = selectActiveTab({
      openTabs: [
        {
          path: 'topics/general.dita',
          kind: 'topic',
          xml: GENERAL_TASK_XML,
          mode: 'visual',
        } as never,
      ],
      activeTabPath: 'topics/general.dita',
    });
    expect(resolveTaskModelForXml(active?.xml)).toBe('general');
    // …and the Visual Editor resolves it from the DOCTYPE preserved in the PM doc prolog.
    const { pmDoc } = xmlToPmDoc(GENERAL_TASK_XML);
    expect(resolveTaskModelForDocument(pmDoc)).toBe('general');
    const { pmDoc: strictPmDoc } = xmlToPmDoc(STRICT_TASK_XML);
    expect(resolveTaskModelForDocument(strictPmDoc)).toBe('strict');
    setTaskContentModelSetting('general');
    expect(resolveTaskModelForDocument(strictPmDoc)).toBe('general');
  });
});
