export const DITA_CORE_VERSION = '0.1.0';

// XML layer
export * from './xml/types.js';
export * from './xml/parser.js';
export * from './xml/serializer.js';
export * from './xml/xpath.js';
export * from './xml/compare.js';

// DITA 1.3 element metadata & content/attribute rules
export * from './model/dita-elements.js';
export * from './model/dita-rules.js';

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
