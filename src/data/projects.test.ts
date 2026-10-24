import { describe, expect, it } from 'vitest';
import { projectLink } from './projects';

const base = { order: 1, name: 'X', role: 'r', stack: [], blurb: 'b', repoPublic: true, featured: false };

describe('project links', () => {
  it('links a public repo to its source', () => {
    expect(projectLink({ ...base, repo: 'github.com/jogee489/x', video: 'ZxlBJATvUNM' }))
      .toEqual({ url: 'https://github.com/jogee489/x', label: 'github.com/jogee489/x' });
  });

  it('links a private repo to its demo video', () => {
    expect(projectLink({ ...base, repoPublic: false, video: 'ZxlBJATvUNM', caseStudy: 'https://jjdorko.com/x' }))
      .toEqual({ url: 'https://www.youtube.com/watch?v=ZxlBJATvUNM', label: 'Watch the demo' });
  });

  it('only says "Watch the demo" when there is a video', () => {
    expect(projectLink({ ...base, repoPublic: false, caseStudy: 'https://jjdorko.com/x' }))
      .toEqual({ url: 'https://jjdorko.com/x', label: 'Read the case study' });
  });
});
