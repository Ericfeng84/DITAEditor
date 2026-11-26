export const DITA_CORE_VERSION = '1.0.0';

// UI locale primitives & bilingual core diagnostics
// (generic UI strings live in the consuming app; core only owns XML/semantics wording)
export * from './i18n/index.js';

// XML layer
export * from './xml/types.js';
export * from './xml/parser.js';
export * from './xml/serializer.js';
export * from './xml/xpath.js';
export * from './xml/compare.js';
export * from './xml/structure-check.js';
export * from './xml/checkin-validate.js';

// DITA 1.3 element metadata & content/attribute rules
export * from './model/task-model.js';
export * from './model/dita-elements.js';
export * from './model/dita-rules.js';
export * from './model/dita-structure.js';

// Topic & Map templates + built-in samples
export * from './templates/topic-templates.js';
export * from './templates/map-templates.js';

// Map/Bookmap tree engine & isomorphic POSIX path utils
export * from './map/path-utils.js';
export * from './map/dita-map.js';

// OASIS CALS table adapter
export * from './cals/cals-table.js';

// ProseMirror schema, helpers & bidirectional lossless bridge
export * from './prosemirror/schema.js';
export * from './prosemirror/helpers.js';
export * from './prosemirror/converter.js';
export * from './prosemirror/structure.js';

// DITAVAL conditional profiling parser & evaluator
export * from './ditaval/ditaval.js';

// Root Map semantic engine (Keyspace, Topic ID index, Conref/Conkeyref, Diagnostics)
export * from './semantics/types.js';
export * from './semantics/keyspace.js';
export * from './semantics/conref.js';
export * from './semantics/semantic-engine.js';

// AI assistance fragment engine (target extraction, constraint prompts, verified splicing)
export * from './ai/index.js';

// Phase 14 document ingest kernel (Markdown outline, DITA plan, lossless map mounting)
export * from './ingest/index.js';
