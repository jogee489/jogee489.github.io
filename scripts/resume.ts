// Runs before every build. Downloads the résumé Google Doc and writes what the site publishes:
//   public/resume.pdf          the résumé to view and download, titled "JJ Dorko – Résumé"
//   public/resume.json         its text, where it came from, and a fingerprint of the doc so a
//                              later run can tell whether it changed
//   src/generated/resume.json  the same, for the shell's resume.txt and skills list
//
// It never publishes a doc that has a phone number in it or isn't the résumé. If the doc can't be
// fetched or fails those checks, it keeps the copy already on jjdorko.com and sets the step
// output `problem`; the deploy's "Résumé check" job then fails with it. Things worth knowing that
// don't stop publishing, like a changed page setup, go in `notice` and fail that job too.
//
//   node scripts/resume.ts              build (what `npm run build` does)
//   node scripts/resume.ts --if-missing reuse the last copy if it came from the doc (`npm run dev`)
//   node scripts/resume.ts --check      only report whether the doc changed since the last deploy
//
//   RESUME_HTML=<file>       build from a saved export instead of Google
//   RESUME_PUBLISHED=<url>   where the last deploy's copy is, instead of https://jjdorko.com
//   RESUME_OUT=<dir>         write under another folder instead of this checkout
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { parseSkills, problemWith, stableExport, toShellLines, type Block, type SkillGroup } from '../src/scripts/resume-format.ts';
import { annotate, setOutputs, summary } from './github.ts';

const DOC = 'https://docs.google.com/document/d/1FB6sleJ1ML4Hoe_g6wiSWh8CZVqXwje7lVZqr0MkE-M/export?format=html';
const LIVE = process.env.RESUME_PUBLISHED ?? 'https://jjdorko.com';
const SOURCE = process.env.RESUME_HTML;
const ROOT = process.env.RESUME_OUT ?? '.';
const OUT = {
  pdf: join(ROOT, 'public/resume.pdf'),
  json: join(ROOT, 'public/resume.json'),
  shell: join(ROOT, 'src/generated/resume.json'),
};
const TITLE = 'JJ Dorko – Résumé';

// The doc is US Letter with 50pt top and bottom margins and 54pt sides (File → Page setup).
// Google's export puts those margins on <body>, which wouldn't repeat on every printed page, so
// the PDF gets them instead. The PDF options take inches: 50pt = 0.694in, 54pt = 0.75in.
const PAGE = { format: 'Letter', margin: { top: '0.694in', bottom: '0.694in', left: '0.75in', right: '0.75in' } } as const;
// The same setup as the export shows it, in CSS pixels: a 612pt page with 54pt and 50pt padding
const EXPORT = { width: 816, sides: 72, ends: 66.7 };

/** where a copy came from: the Google Doc, a saved export, the published site, or a placeholder */
type From = 'doc' | 'file' | 'published' | 'placeholder';
type Resume = { lines: string[]; skills: SkillGroup[]; source?: string; from?: From };
type Built = { pdf: Buffer; text: Resume; problem?: string; notices: string[] };

const fingerprint = (html: string) => createHash('sha256').update(stableExport(html)).digest('hex');

async function get(url: string) {
  const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`${url} answered ${res.status}`);
  return res;
}

const readExport = async () => (SOURCE ? readFile(SOURCE, 'utf8') : (await get(DOC)).text());

/** a reason not to publish this export */
class Problem extends Error {}

/** prints the export to PDF and reads its text; throws a Problem if it shouldn't be published */
async function fromDoc(html: string): Promise<Omit<Built, 'problem'>> {
  const { chromium } = await import('@playwright/test');
  // PLAYWRIGHT_CHROMIUM_PATH: a Chromium already on the machine, as in playwright.config.ts
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle' });
    const { blocks, pageText, links, box } = await page.evaluate(title => {
      // read the page setup before moving the margins off <body>
      const s = getComputedStyle(document.body);
      const px = (v: string) => parseFloat(v);
      const box = { width: px(s.maxWidth) + px(s.paddingLeft) + px(s.paddingRight), sides: px(s.paddingLeft), ends: px(s.paddingTop) };
      document.title = title;
      document.body.style.padding = '0';
      document.body.style.maxWidth = 'none';
      const bold = (el: Element) => {
        const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        let any = false;
        while (walk.nextNode()) {
          const t = walk.currentNode as Text;
          if (!t.data.trim()) continue;
          any = true;
          if (Number(getComputedStyle(t.parentElement!).fontWeight) < 600) return false;
        }
        return any;
      };
      const blocks = [...document.querySelectorAll('p, li, h1, h2, h3, h4, h5, h6')].map(el => ({
        tag: el.tagName.toLowerCase(),
        text: (el.textContent ?? '').replace(/\s+/g, ' ').trim(),
        bold: bold(el),
      }));
      const links = [...document.querySelectorAll('a[href]')].map(a => a.getAttribute('href')!);
      return { blocks: blocks.filter(b => b.text), pageText: document.body.innerText, links, box };
    }, TITLE);

    const problem = problemWith(blocks as Block[], pageText, links);
    if (problem) throw new Problem(problem);
    const notices: string[] = [];
    const off = (a: number, b: number) => !(Math.abs(a - b) < 2);
    if (off(box.width, EXPORT.width) || off(box.sides, EXPORT.sides) || off(box.ends, EXPORT.ends)) {
      notices.push("the doc's page size or margins changed from US Letter with 50pt and 54pt margins; update PAGE and EXPORT in scripts/resume.ts");
    }
    const skills = parseSkills(blocks);
    if (!skills.length) {
      notices.push('the doc has no "Label: a, b, c" lines under a bold TECHNICAL SKILLS title, so the shell shows its built-in skills list');
    }
    const pdf = await page.pdf({ ...PAGE, printBackground: true });
    return { pdf, text: { lines: toShellLines(blocks), skills, source: fingerprint(html) }, notices };
  } finally {
    await browser.close();
  }
}

/** a one-page PDF with a line of text, made without a browser, for offline local builds */
function placeholderPdf(line: string) {
  const content = `BT /F1 14 Tf 72 700 Td (${line.replace(/[\\()]/g, '\\$&')}) Tj ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Title (JJ Dorko - Resume placeholder) >>',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = objects.map((o, i) => {
    const at = pdf.length;
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
    return at;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map(o => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, 'latin1');
}

async function build(): Promise<Built> {
  const name = SOURCE ?? 'the Google Doc';
  let problem: string;
  try {
    const built = await fromDoc(await readExport());
    return { ...built, text: { ...built.text, from: SOURCE ? 'file' : 'doc' } };
  } catch (e) {
    problem = e instanceof Problem ? e.message : `couldn't read ${name} (${(e as Error).message})`;
  }
  try {
    // Keep the published copy, fingerprint included, so the next daily check tries the doc again
    const pdf = Buffer.from(await (await get(`${LIVE}/resume.pdf`)).arrayBuffer());
    const text = (await (await get(`${LIVE}/resume.json`)).json()) as Resume;
    return { pdf, text: { ...text, from: 'published' }, problem: `kept the copy already on ${LIVE}: ${problem}`, notices: [] };
  } catch (e) {
    problem += `; couldn't reuse the copy on ${LIVE} either (${(e as Error).message})`;
  }
  if (process.env.CI) {
    annotate('error', 'Résumé', `${problem}. Stopping, so the site isn't published without a résumé.`);
    process.exit(1);
  }
  console.warn(`résumé: ${problem}. Writing a placeholder for this local build.`);
  const line = 'The resume is built from Google Docs when the site is deployed.';
  return { pdf: placeholderPdf(line), text: { lines: [line], skills: [], from: 'placeholder' }, notices: [] };
}

async function readJson<T>(file: string) {
  try {
    return JSON.parse(await readFile(file, 'utf8')) as T;
  } catch {
    return undefined;
  }
}

if (process.argv.includes('--check')) {
  // Cheap: no browser. Anything uncertain counts as changed, so the build runs and reports it.
  let changed = 'true';
  try {
    const [html, live] = await Promise.all([readExport(), get(`${LIVE}/resume.json`).then(r => r.json() as Promise<Resume>)]);
    if (live.source === fingerprint(html)) changed = 'false';
  } catch (e) {
    console.log(`résumé: can't compare (${(e as Error).message}), so treating it as changed`);
  }
  console.log(`résumé: changed since the last deploy: ${changed}`);
  await setOutputs({ changed });
} else {
  const last = await readJson<Resume>(OUT.shell);
  // A copy built from the test export or a placeholder isn't worth keeping
  if (process.argv.includes('--if-missing') && (last?.from === 'doc' || last?.from === 'published')) {
    console.log('résumé: using the copy from the last build (run `npm run resume` to refresh it)');
  } else {
    const { pdf, text, problem, notices } = await build();
    for (const file of Object.values(OUT)) await mkdir(dirname(file), { recursive: true });
    await writeFile(OUT.pdf, pdf);
    await writeFile(OUT.json, JSON.stringify(text));
    await writeFile(OUT.shell, JSON.stringify(text, null, 2));
    console.log(`résumé: built from ${text.from}, ${text.lines.length} lines, ${text.skills.length} skill groups`);
    if (problem) annotate('error', 'Résumé not updated', problem);
    for (const n of notices) annotate('warning', 'Résumé', n);
    await setOutputs({ problem: problem ?? '', notice: notices.join(' / ') });
    await summary('Résumé', [problem, ...notices].filter(Boolean).map(m => `- ${m}`).join('\n') || `Built from ${text.from}.`);
  }
}
