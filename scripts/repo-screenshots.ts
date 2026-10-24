// Lists the repos in the "Everything else on GitHub" strip that have no .github/screenshot.png,
// so they show as plain name cards. Runs in the deploy and writes the list to the run summary;
// it never fails the deploy.
import { appendFile } from 'node:fs/promises';
import { REPOS_API, screenshotUrl, shown, type Repo } from '../src/data/repos.ts';

const headers: Record<string, string> = process.env.GH_TOKEN ? { Authorization: `Bearer ${process.env.GH_TOKEN}` } : {};
let report: string;
try {
  const res = await fetch(REPOS_API, { headers, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`GitHub answered ${res.status}`);
  const repos = shown((await res.json()) as Repo[]);
  const found = await Promise.all(
    repos.map(r => fetch(screenshotUrl(r), { method: 'HEAD', signal: AbortSignal.timeout(20_000) }).then(res => res.ok, () => false)),
  );
  const missing = repos.filter((_, i) => !found[i]).map(r => r.name);
  report = missing.length
    ? `${missing.length} of ${repos.length} repos in the strip have no \`.github/screenshot.png\`:\n\n${missing.map(n => `- ${n}`).join('\n')}`
    : `All ${repos.length} repos in the strip have a screenshot.`;
} catch (e) {
  report = `Couldn't check the repo screenshots (${(e as Error).message}).`;
}
console.log(report);
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `### Repo screenshots\n\n${report}\n`);
