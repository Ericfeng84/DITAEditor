/**
 * Phase 14 — document ingest module surface.
 *
 * Stage 1 (parser router), Stage 2 (Planner/Writer/Validator agents) and Stage 3 (queue,
 * materializer, REST/SSE routes) are exported from one place so `index.ts` can wire the module
 * without depending on internal file layout.
 */

export * from './parser-settings-service.js';
export * from './parsers/parser-router.js';
export * from './agent/index.js';
export * from './materializer.js';
export * from './ingest-service.js';
export * from './routes.js';
