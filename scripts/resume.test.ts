// Runs scripts/resume.ts the way the build does, each time in a temporary folder, with a local
// server standing in for jjdorko.com. Needs Playwright's Chromium, like the build.
import { execFile } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const FIXTURE = 'tests/fixtures/resume-export.html';
const PHONE = '090‐1234‐5678'; // made up, with the U+2010 hyphens word processors use

type Run = { code: number; out: string; outputs: Record<string, string> };

/** runs the script and returns its exit code, its console output and the step outputs it set */
async function resume(args: string[], env: Record<string, string>): Promise<Run> {
  const dir = await mkdtemp(join(tmpdir(), 'resume-'));
  const outputs = join(dir, 'outputs');
  await writeFile(outputs, '');
  const { code, out } = await new Promise<{ code: number; out: string }>(resolve =>
    execFile(process.execPath, ['scripts/resume.ts', ...args], {
      env: { ...process.env, CI: '', GITHUB_ACTIONS: '', GITHUB_STEP_SUMMARY: '', GITHUB_OUTPUT: outputs, ...env },
    }, (err, stdout, stderr) => resolve({ code: err ? Number(err.code) || 1 : 0, out: stdout + stderr })),
  );
  const lines = (await readFile(outputs, 'utf8')).split('\n').filter(Boolean);
  // every output must be one key=value line, or the runner fails the step
  for (const l of lines) expect(l, 'step output').toMatch(/^\w+=.*$/);
  return { code, out, outputs: Object.fromEntries(lines.map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)])) };
}

const files = (root: string) => ({
  pdf: () => readFile(join(root, 'public/resume.pdf')),
  json: async () => JSON.parse(await readFile(join(root, 'public/resume.json'), 'utf8')),
  shell: async () => JSON.parse(await readFile(join(root, 'src/generated/resume.json'), 'utf8')),
});
const pdfTitle = (pdf: Buffer) => {
  const hex = pdf.toString('latin1').match(/\/Title\s*<FEFF([0-9A-F]+)>/i)?.[1];
  return hex && Buffer.from(hex, 'hex').swap16().toString('utf16le');
};

let fixture: string;
let withPhone: string;
let published: string; // what the stand-in jjdorko.com serves
let server: Server;
let live: string;

beforeAll(async () => {
  const dir = await mkdtemp(join(tmpdir(), 'resume-docs-'));
  fixture = await readFile(FIXTURE, 'utf8');
  withPhone = join(dir, 'with-phone.html');
  await writeFile(withPhone, fixture.replace('jdorko90@gmail.com</span>', `jdorko90@gmail.com &nbsp;| &nbsp;${PHONE}</span>`));

  // a first clean build becomes "the copy already published"
  published = await mkdtemp(join(tmpdir(), 'resume-live-'));
  const first = await resume([], { RESUME_HTML: FIXTURE, RESUME_OUT: published });
  expect(first.code).toBe(0);
  server = createServer(async (req, res) => {
    try {
      res.end(await readFile(join(published, 'public', req.url!)));
    } catch {
      res.statusCode = 404;
      res.end();
    }
  });
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
  live = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
}, 60_000);

afterAll(() => new Promise<void>(r => server.close(() => r())));

describe('building the résumé', { timeout: 60_000 }, () => {
  it('publishes a clean doc: a Letter PDF with its title, the shell text, and a fingerprint', async () => {
    const out = await mkdtemp(join(tmpdir(), 'resume-out-'));
    const run = await resume([], { RESUME_HTML: FIXTURE, RESUME_OUT: out, CI: '1', GITHUB_ACTIONS: 'true' });
    expect(run.code).toBe(0);
    expect(run.outputs).toEqual({ problem: '', notice: '' });
    const pdf = await files(out).pdf();
    expect(pdf.toString('latin1')).toMatch(/\/MediaBox \[0 0 612 792\]/);
    expect(pdfTitle(pdf)).toBe('JJ Dorko – Résumé');
    const json = await files(out).json();
    expect(json.lines[1]).toContain('joseph (jj) dorko — resume.txt');
    expect(json.skills.map((g: { label: string }) => g.label)).toContain('Languages');
    expect(json.source).toMatch(/^[0-9a-f]{64}$/);
    expect(json.from).toBe('file');
    expect(await files(out).shell()).toEqual(json);
  });

  it('refuses a doc with a phone number and keeps the published copy, saying why without the number', async () => {
    const out = await mkdtemp(join(tmpdir(), 'resume-out-'));
    const run = await resume([], { RESUME_HTML: withPhone, RESUME_PUBLISHED: live, RESUME_OUT: out, CI: '1', GITHUB_ACTIONS: 'true' });
    expect(run.code).toBe(0);
    expect(run.outputs.problem).toMatch(/^kept the copy already on .*: the doc has a phone number \(paragraph 2\)/);
    expect(run.outputs.notice).toBe('');
    expect(run.out).toContain('::error title=Résumé not updated::');
    expect(run.out).not.toContain('1234');
    expect(await files(out).pdf()).toEqual(await files(published).pdf());
    expect((await files(out).json()).lines).toEqual((await files(published).json()).lines);
    expect((await files(out).json()).from).toBe('published');
  });

  it('refuses a doc that only links to a phone number', async () => {
    const linked = join(await mkdtemp(join(tmpdir(), 'resume-docs-')), 'linked.html');
    await writeFile(linked, fixture.replace('jdorko90@gmail.com</span>', 'jdorko90@gmail.com &nbsp;| &nbsp;<a href="https://www.google.com/url?q=tel:%2B81-90-1234-5678&amp;sa=D">call me</a></span>'));
    const out = await mkdtemp(join(tmpdir(), 'resume-out-'));
    const run = await resume([], { RESUME_HTML: linked, RESUME_PUBLISHED: live, RESUME_OUT: out, CI: '1', GITHUB_ACTIONS: 'true' });
    expect(run.outputs.problem).toMatch(/links to a phone number/);
    expect(await files(out).pdf()).toEqual(await files(published).pdf());
  });

  it('stops a CI build when there is no copy to fall back to', async () => {
    const out = await mkdtemp(join(tmpdir(), 'resume-out-'));
    const run = await resume([], { RESUME_HTML: withPhone, RESUME_PUBLISHED: 'http://127.0.0.1:9', RESUME_OUT: out, CI: '1', GITHUB_ACTIONS: 'true' });
    expect(run.code).toBe(1);
    expect(run.out).toMatch(/::error title=Résumé::.*Stopping/);
    await expect(stat(join(out, 'public/resume.pdf'))).rejects.toThrow();
  });

  it('publishes but gives notice when the page setup changes', async () => {
    const a4 = join(await mkdtemp(join(tmpdir(), 'resume-docs-')), 'a4.html');
    await writeFile(a4, fixture.replace('max-width:504pt;padding:50pt 54pt 50pt 54pt', 'max-width:451.3pt;padding:72pt'));
    const out = await mkdtemp(join(tmpdir(), 'resume-out-'));
    const run = await resume([], { RESUME_HTML: a4, RESUME_OUT: out, CI: '1', GITHUB_ACTIONS: 'true' });
    expect(run.code).toBe(0);
    expect(run.outputs.problem).toBe('');
    expect(run.outputs.notice).toMatch(/page size or margins changed/);
    expect((await files(out).json()).from).toBe('file');
  });

  it('writes a placeholder for an offline local build, and dev rebuilds it next time', async () => {
    const out = await mkdtemp(join(tmpdir(), 'resume-out-'));
    const missing = { RESUME_HTML: '/nonexistent.html', RESUME_PUBLISHED: 'http://127.0.0.1:9', RESUME_OUT: out };
    expect((await resume([], missing)).code).toBe(0);
    expect((await files(out).pdf()).subarray(0, 5).toString()).toBe('%PDF-');
    expect((await files(out).json()).from).toBe('placeholder');
    expect((await resume(['--if-missing'], missing)).out).toMatch(/Writing a placeholder/);
  });
});

describe('npm run dev (--if-missing)', { timeout: 60_000 }, () => {
  it('reuses a copy that came from the doc', async () => {
    const out = await mkdtemp(join(tmpdir(), 'resume-out-'));
    await cp(join(published, 'public'), join(out, 'public'), { recursive: true });
    await mkdir(join(out, 'src/generated'), { recursive: true });
    const fromDoc = { ...(await files(published).json()), from: 'doc' };
    await writeFile(join(out, 'src/generated/resume.json'), JSON.stringify(fromDoc));
    const run = await resume(['--if-missing'], { RESUME_HTML: '/nonexistent.html', RESUME_OUT: out });
    expect(run.out).toMatch(/using the copy from the last build/);
    expect(await files(out).shell()).toEqual(fromDoc);
  });

  it('rebuilds a copy made from the test export', async () => {
    const out = await mkdtemp(join(tmpdir(), 'resume-out-'));
    await resume([], { RESUME_HTML: FIXTURE, RESUME_OUT: out });
    const run = await resume(['--if-missing'], { RESUME_HTML: FIXTURE, RESUME_OUT: out });
    expect(run.out).toMatch(/built from file/);
  });
});

describe('the daily check (--check)', { timeout: 60_000 }, () => {
  it('says unchanged when the doc matches the published fingerprint', async () => {
    expect((await resume(['--check'], { RESUME_HTML: FIXTURE, RESUME_PUBLISHED: live })).outputs).toEqual({ changed: 'false' });
  });

  it('says changed when the doc changed', async () => {
    expect((await resume(['--check'], { RESUME_HTML: withPhone, RESUME_PUBLISHED: live })).outputs).toEqual({ changed: 'true' });
  });

  it('says changed when it can\'t tell, so the build runs and reports why', async () => {
    expect((await resume(['--check'], { RESUME_HTML: FIXTURE, RESUME_PUBLISHED: 'http://127.0.0.1:9' })).outputs).toEqual({ changed: 'true' });
  });
});
