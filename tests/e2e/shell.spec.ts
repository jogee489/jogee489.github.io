// End-to-end checks for the parts the unit tests can't see: keyboard shortcuts, the
// full-screen console, scrolling, and the monitor and console sharing one shell.
import { expect, test, type Page } from '@playwright/test';

const REPOS = [
  { name: 'rails-chat', full_name: 'jogee489/rails-chat', html_url: 'https://github.com/jogee489/rails-chat', fork: false, default_branch: 'main' },
  { name: 'smart-cart', full_name: 'jogee489/smart-cart', html_url: 'https://github.com/jogee489/smart-cart', fork: false, default_branch: 'main' },
];
const ERROR = /No such file|Is a directory|not a directory|command not found/;

test.beforeEach(async ({ page }) => {
  // Offline and repeatable: fixed repo list, no screenshots, no web fonts
  await page.route('https://api.github.com/**', route => route.fulfill({ json: REPOS }));
  await page.route('https://raw.githubusercontent.com/**', route => route.fulfill({ status: 404 }));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, route => route.abort());
  // Record links instead of opening tabs
  await page.addInitScript(() => {
    const w = window as typeof window & { opened: string[] };
    w.opened = [];
    w.open = ((url: string) => { w.opened.push(url); return null; }) as typeof window.open;
  });
  await page.goto('/');
});

const con = (page: Page) => page.locator('#console');

async function openConsole(page: Page) {
  await page.keyboard.press('Backquote');
  await expect(con(page)).toHaveClass(/open/);
  await expect(page.locator('#console-input')).toBeFocused();
}

async function submit(page: Page, cmd: string) {
  await page.locator('#console-input').fill(cmd);
  await page.locator('#console-input').press('Enter');
}

/** runs a command in the console and returns the lines it printed */
async function run(page: Page, cmd: string) {
  const lines = page.locator('#console-out .ln');
  const prompts = page.locator('#console-out .ln.in');
  const before = await lines.count();
  const n = await prompts.count();
  await submit(page, cmd);
  await expect(prompts).toHaveCount(n + 1);
  return (await lines.allTextContents()).slice(before + 1).map(s => s.replace(/ /g, ''));
}

test('backtick opens the full-screen shell from the desk, and Esc closes it', async ({ page }) => {
  await openConsole(page);
  await expect(con(page)).toBeInViewport({ ratio: 1 });
  await page.keyboard.press('Escape');
  await expect(con(page)).not.toHaveClass(/open/);
  await expect(page.locator('.scene-copy h1')).toBeVisible();
});

test('everything ls shows can be listed or printed', async ({ page }) => {
  await openConsole(page);
  const visited: string[] = [];
  const visit = async (path: string) => {
    const listing = await run(page, path ? `ls ${path}` : 'ls');
    expect(listing.join('\n'), `ls ${path}`).not.toMatch(ERROR);
    // one line of names, or one `name   note` line per entry
    const names = listing.length > 1 ? listing.map(l => l.split(/\s{2,}/)[0]) : listing[0].split(/\s{2,}/);
    for (const name of names) {
      const child = (path ? `${path}/` : '') + name.replace(/\/$/, '');
      visited.push(child);
      if (name.endsWith('/')) await visit(child);
      else {
        const body = await run(page, `cat ${child}`);
        expect(body.join('\n'), `cat ${child}`).not.toMatch(ERROR);
        expect(body.join('').trim(), `cat ${child} is empty`).not.toBe('');
      }
    }
  };
  await visit('');
  // Files come from the page itself, so these prove the page content reached the shell
  expect(visited).toEqual(expect.arrayContaining([
    'about/about.txt', 'experience/vocera.txt', 'experience/its.txt', 'experience/education.txt',
    'work/heartopia-hub', 'repos/rails-chat', 'contact/linkedin', 'resume.txt',
  ]));
  expect(await run(page, 'cat experience/vocera.txt')).toContain('Platform Developer II and Scrum Master · Vocera Communications');
});

test('cd moves the page, and ls follows the working directory', async ({ page }) => {
  await openConsole(page);
  // cd closes the console to show the page, so there's no output to wait for
  await submit(page, 'cd experience');
  await expect(con(page)).not.toHaveClass(/open/);
  await expect(page.locator('#experience')).toBeInViewport();
  await expect(page.locator('.side-shell [data-cwd]')).toHaveText('~/experience');
  await openConsole(page);
  expect(await run(page, 'ls')).toEqual(['vocera.txt  its.txt  education.txt']);
});

test('commands work the same wherever the page is scrolled', async ({ page }) => {
  await page.locator('#experience').scrollIntoViewIfNeeded();
  await expect(page.locator('.side-shell [data-cwd]')).toHaveText('~/experience');
  await openConsole(page);
  expect(await run(page, 'ls')).toEqual(['vocera.txt  its.txt  education.txt']);
  expect((await run(page, 'ls work')).join('\n')).toContain('heartopia-hub');
  expect((await run(page, 'cat resume.txt')).join('\n')).toContain('resume.txt');
  await submit(page, 'cd about');
  await expect(con(page)).not.toHaveClass(/open/);
  await expect(page.locator('#about')).toBeInViewport();
  await expect(page.locator('.side-shell [data-cwd]')).toHaveText('~/about');
});

test('typing on the desk goes to the monitor, and the console shares its history', async ({ page }) => {
  await page.keyboard.type('whoami');
  await expect(page.locator('#screen-input')).toBeFocused();
  await expect(page.locator('#screen-input')).toHaveValue('whoami');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Backquote');
  await expect(con(page)).toHaveClass(/open/);
  await expect(page.locator('#console-out .ln.in').last()).toHaveText('jj@dorko:~$ whoami');
});

test('open and resume launch the right links', async ({ page }) => {
  await openConsole(page);
  await run(page, 'open leap');
  await run(page, 'open contact/linkedin');
  await run(page, 'resume');
  expect(await page.evaluate(() => (window as typeof window & { opened: string[] }).opened)).toEqual([
    'https://github.com/jogee489/leap',
    'https://linkedin.com/in/jjdorko',
    'https://docs.google.com/document/d/1lEfCjaSvtYKnsLCRMSEz7S896fTxNUJinJZli5wpCro/view',
  ]);
});

test('tab completes paths in the console', async ({ page }) => {
  await openConsole(page);
  const input = page.locator('#console-input');
  await input.fill('cat work/heart');
  await input.press('Tab');
  await expect(input).toHaveValue('cat work/heartopia-hub');
  await input.fill('ls ex');
  await input.press('Tab');
  await expect(input).toHaveValue('ls experience/');
});
