import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const blog = defineCollection({
	loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
	schema: ({ image }) =>
		z.object({
			title: z.string(),
			description: z.string(),
			pubDate: z.coerce.date(),
			updatedDate: z.coerce.date().optional(),
			heroImage: z.optional(image()),
		}),
});

const projects = defineCollection({
	loader: glob({ base: './src/content/projects', pattern: '**/*.{md,mdx}' }),
	schema: z
		.object({
			order: z.number(),
			name: z.string(),
			role: z.string(),
			stack: z.array(z.string()),
			blurb: z.string(),
			// host and path without https://; a private repo can leave it out
			repo: z.string().optional(),
			repoPublic: z.boolean().default(true),
			// a screenshot; for a project with a video it's the poster shown before play
			image: z.string().optional(),
			// YouTube video ID, played in Work with a click-to-load player
			video: z.string().regex(/^[\w-]{11}$/, 'a YouTube video ID, like ZxlBJATvUNM').optional(),
			// e.g. "In development"
			status: z.string().optional(),
			caseStudy: z.string().url().optional(),
			// the one project shown large at the top of Work
			featured: z.boolean().default(false),
		})
		.refine(p => !p.repoPublic || p.repo, { message: 'a public repo needs repo', path: ['repo'] })
		.refine(p => p.repoPublic || p.video || p.caseStudy, {
			message: 'a private project needs a video or caseStudy to link to',
			path: ['repoPublic'],
		}),
});

export const collections = { blog, projects };
