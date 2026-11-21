export const DITA_CORE_VERSION = '0.1.0';

// XML layer
export * from './xml/types.js';
export * from './xml/parser.js';
export * from './xml/serializer.js';
export * from './xml/xpath.js';
export * from './xml/compare.js';

// DITA 1.3 element metadata
export * from './model/dita-elements.js';

// OASIS CALS table adapter
export * from './cals/cals-table.js';

// ProseMirror schema & bidirectional lossless bridge
export * from './prosemirror/schema.js';
export * from './prosemirror/converter.js';
