import { defineCollection, z } from 'astro:content';

const projects = defineCollection({
	type: 'content',
	schema: z.object({
		order: z.number(),
		name: z.string(),
		role: z.string(),
		stack: z.array(z.string()),
		blurb: z.string(),
		repo: z.string(),
		tile: z.string(),
		image: z.string().optional(),
	}),
});

export const collections = { projects };
