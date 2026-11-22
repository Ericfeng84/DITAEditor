import losslessRoundtripRaw from './presets/lossless-roundtrip.dita?raw';
import taskAuthoringRaw from './presets/task-authoring.dita?raw';
import calsTableRaw from './presets/cals-table.dita?raw';
import singleSourcingRaw from './presets/single-sourcing.dita?raw';
import singleSourcingMapRaw from './presets/single-sourcing.ditamap?raw';
import cloudDitavalRaw from './presets/cloud.ditaval?raw';
import onpremDitavalRaw from './presets/onprem.ditaval?raw';
import type { LocalizedString } from '../i18n/index.js';

export type PlaygroundPresetId =
  | 'lossless-roundtrip'
  | 'task-authoring'
  | 'cals-table'
  | 'single-sourcing';

export interface PlaygroundDitavalProfile {
  id: string;
  label: LocalizedString;
  xml: string;
}

export interface PlaygroundKeyspaceFixture {
  rootMapPath: string;
  files: Record<string, string>;
}

export interface PlaygroundPreset {
  id: PlaygroundPresetId;
  xml: string;
  /** Optional root map + topic files used to build a real keyspace with @dita/core. */
  keyspace?: PlaygroundKeyspaceFixture;
  ditavalProfiles?: PlaygroundDitavalProfile[];
}

/**
 * The four scenarios are trimmed from `samples/demo-dita-project/` and the golden fixtures in
 * `packages/dita-core/test/fixtures/`. They are bundled as raw text so the playground never
 * fetches anything at runtime.
 */
export const PLAYGROUND_PRESETS: readonly PlaygroundPreset[] = [
  {
    id: 'lossless-roundtrip',
    xml: losslessRoundtripRaw,
  },
  {
    id: 'task-authoring',
    xml: taskAuthoringRaw,
  },
  {
    id: 'cals-table',
    xml: calsTableRaw,
  },
  {
    id: 'single-sourcing',
    xml: singleSourcingRaw,
    keyspace: {
      rootMapPath: 'root.ditamap',
      files: {
        'root.ditamap': singleSourcingMapRaw,
        'single-sourcing.dita': singleSourcingRaw,
      },
    },
    ditavalProfiles: [
      { id: 'cloud', label: { zh: 'Cloud Edition', en: 'Cloud Edition' }, xml: cloudDitavalRaw },
      {
        id: 'onprem',
        label: { zh: 'On-Prem Admin', en: 'On-Prem Admin' },
        xml: onpremDitavalRaw,
      },
    ],
  },
];

export function getPreset(id: PlaygroundPresetId): PlaygroundPreset {
  return PLAYGROUND_PRESETS.find((preset) => preset.id === id) ?? PLAYGROUND_PRESETS[0]!;
}

/** Compact sample used by the home-page mini demo (same pipeline as the full playground). */
export const MINI_DEMO_XML = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE task PUBLIC "-//OASIS//DTD DITA Task//EN" "task.dtd">
<!-- Mini demo: edit the text, keep the metadata -->
<task id="task_backup" audience="author" outputclass="demo">
  <title>备份工作区数据</title>
  <taskbody>
    <steps>
      <step>
        <cmd>停止写入并创建快照</cmd>
        <info>备份目录：<filepath>/data/backup</filepath>，由 <uicontrol>管理员</uicontrol> 触发。</info>
      </step>
      <step>
        <cmd>校验快照完整性</cmd>
        <?oxy_comment_start author="reviewer" timestamp="20261122T090000+0800" comment="这里必须保留 PI"?>
        <info>记录校验和并写入审计日志。</info>
      </step>
    </steps>
    <note type="tip">
      <p>快照文件默认保留 14 天。</p>
    </note>
  </taskbody>
</task>
`;
