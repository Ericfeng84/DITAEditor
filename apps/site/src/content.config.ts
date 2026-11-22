import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/**
 * Docs live in `src/content/docs/<locale>/<slug>.md`. The `id` produced by the glob loader keeps
 * the locale prefix (`zh/features`), which is what `docs/[slug].astro` filters on.
 */
const docs = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/docs' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    updated: z.string().optional(),
    draft: z.boolean().optional(),
  }),
});

export const collections = { docs };
