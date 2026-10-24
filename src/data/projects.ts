import type { CollectionEntry } from 'astro:content';

type Project = CollectionEntry<'projects'>['data'];

export const watchUrl = (video: string) => `https://www.youtube.com/watch?v=${video}`;

/** where a project links to, and what to call that link: its source when the repo is public,
    otherwise its demo video, otherwise its case study */
export function projectLink(p: Project) {
  if (p.repoPublic && p.repo) return { url: `https://${p.repo}`, label: p.repo };
  if (p.video) return { url: watchUrl(p.video), label: 'Watch the demo' };
  return { url: p.caseStudy!, label: 'Read the case study' };
}

export const projectUrl = (p: Project) => projectLink(p).url;
