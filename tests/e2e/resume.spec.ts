// The résumé the build makes from the Google Doc: a PDF to view or download, and the shell's copy.
// In CI that's the real résumé, and locally the saved export in tests/fixtures, so these check
// what any résumé must have rather than its wording.
import { expect, test } from '@playwright/test';
import { findPhone } from '../../src/scripts/resume-format';
import { opened, openConsole, recordOpens, run } from './console';

test.beforeEach(async ({ page }) => {
  await page.route('https://api.github.com/**', route => route.fulfill({ json: [] }));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, route => route.abort());
  await recordOpens(page);
  await page.goto('/');
});

test('the résumé links open the PDF in a tab, and one downloads it', async ({ page }) => {
  const side = page.locator('.side').getByRole('link', { name: 'Résumé' });
  await expect(side).toHaveAttribute('href', '/resume.pdf');
  await expect(side).toHaveAttribute('target', '_blank');
  const creds = page.locator('#experience .creds');
  await expect(creds.getByRole('link', { name: 'Résumé (PDF)' })).toHaveAttribute('href', '/resume.pdf');
  await expect(creds.getByRole('link', { name: 'Download' })).toHaveAttribute('download', 'JJ-Dorko-Resume.pdf');
});

test('the site serves the PDF', async ({ request }) => {
  const res = await request.get('/resume.pdf');
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toContain('application/pdf');
  const pdf = await res.body();
  expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  // US Letter, like the doc
  expect(pdf.toString('latin1')).toMatch(/\/MediaBox \[0 0 612 792\]/);
});

test('cat resume.txt prints the whole résumé, with sections and no phone number', async ({ page }) => {
  await openConsole(page);
  const out = await run(page, 'cat resume.txt');
  expect(out[1]).toMatch(/— resume\.txt/);
  expect(out.filter(l => l.startsWith('── ')).length).toBeGreaterThanOrEqual(3);
  expect(out.length).toBeGreaterThan(20);
  expect(findPhone(out.join('\n'))).toBeUndefined();
});

test('resume prints the résumé and opens the PDF', async ({ page }) => {
  await openConsole(page);
  const out = await run(page, 'resume');
  expect(out[1]).toMatch(/— resume\.txt/);
  expect(out.at(-1)).toBe('→ opening the résumé (PDF) …');
  expect(await opened(page)).toEqual(['/resume.pdf']);
});

test('skills lists the groups from the résumé, lined up', async ({ page }) => {
  await openConsole(page);
  const out = await run(page, 'skills');
  expect(out.length).toBeGreaterThanOrEqual(3);
  // every line is "label   items", with the items starting in the same column
  const starts = out.map(l => l.match(/^\S.*?\s{3,}(?=\S)/)?.[0].length);
  expect(starts.every(Boolean), out.join('\n')).toBe(true);
  expect(new Set(starts).size).toBe(1);
});
