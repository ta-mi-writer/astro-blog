import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const posts = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/posts" }),
  schema: z.object({
    title: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    description: z.string(),
    thumbnailUrl: z.string().url().optional(),
    videoUrl: z.string().url().optional(),
    fanzaUrl: z.string().url().optional(),
    categories: z.array(z.string()).optional(),
  }),
});

export const collections = { posts };
