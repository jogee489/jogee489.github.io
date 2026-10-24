// The repos the "Everything else on GitHub" strip shows, shared with the deploy's report of
// repos that still need a screenshot (scripts/repo-screenshots.ts)
export const GITHUB_USER = 'jogee489';
export const REPOS_API = `https://api.github.com/users/${GITHUB_USER}/repos?per_page=100&sort=updated`;

// Repos left out of the strip
export const EXCLUDED = new Set([
  'jogee489.github.io',
]);

export type Repo = { name: string; full_name: string; html_url: string; fork: boolean; default_branch: string };

export const shown = (repos: Repo[]) => repos.filter(r => !r.fork && !EXCLUDED.has(r.name));

/** each repo's card picture, by convention at .github/screenshot.png */
export const screenshotUrl = (r: Repo) =>
  `https://raw.githubusercontent.com/${r.full_name}/${r.default_branch}/.github/screenshot.png`;
