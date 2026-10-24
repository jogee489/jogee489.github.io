// End-to-end checks for the parts the unit tests can't see: keyboard shortcuts, the
// full-screen console, scrolling, and the monitor and console sharing one shell.
import { expect, test } from '@playwright/test';
import { con, opened, openConsole, printed, recordOpens, run, submit } from './console';

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
  await recordOpens(page);
  await page.goto('/');
});

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
    'about/about.txt', 'experience/metech.txt', 'experience/teaching.txt', 'experience/independent.txt',
    'experience/vocera.txt', 'experience/its.txt', 'experience/education.txt',
    'work/heartopia-hub', 'repos/rails-chat', 'contact/linkedin', 'resume.txt',
  ]));
  expect(await run(page, 'cat experience/vocera.txt')).toContain('Platform Developer II and Scrum Master · Vocera Communications');
});

test('cd moves the page, and ls follows the working directory', async ({ page }) => {
  await openConsole(page);
  // cd closes the console to show the page, so there's no output to wait for
  await submit(page, 'cd experience');
  await expect(con(page)).not.toHaveClass(/open/);
  await expect(page.locator('#experience')).toBeInViewport({ timeout: 15_000 });
  await expect(page.locator('.side-shell [data-cwd]')).toHaveText('~/experience');
  await openConsole(page);
  expect(await run(page, 'ls')).toEqual(['metech.txt  teaching.txt  independent.txt  vocera.txt  its.txt  education.txt']);
});

test('commands work the same wherever the page is scrolled', async ({ page }) => {
  await page.locator('#experience').scrollIntoViewIfNeeded();
  await expect(page.locator('.side-shell [data-cwd]')).toHaveText('~/experience');
  await openConsole(page);
  expect(await run(page, 'ls')).toEqual(['metech.txt  teaching.txt  independent.txt  vocera.txt  its.txt  education.txt']);
  expect((await run(page, 'ls work')).join('\n')).toContain('heartopia-hub');
  expect((await run(page, 'cat resume.txt')).join('\n')).toContain('resume.txt');
  await submit(page, 'cd about');
  await expect(con(page)).not.toHaveClass(/open/);
  await expect(page.locator('#about')).toBeInViewport({ timeout: 15_000 });
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

test('open and resume each say what they open, and open it', async ({ page }) => {
  await openConsole(page);
  const last = async () => (await opened(page)).at(-1);
  expect(await run(page, 'open sensei-connect')).toEqual(['Opening youtube.com/watch?v=ZxlBJATvUNM']);
  expect(await last()).toBe('https://www.youtube.com/watch?v=ZxlBJATvUNM');
  expect(await run(page, 'open contact/linkedin')).toEqual(['Opening linkedin.com/in/jjdorko']);
  expect(await last()).toBe('https://www.linkedin.com/in/jjdorko');
  expect((await run(page, 'resume')).at(-1)).toBe('→ opening the résumé (PDF) …');
  expect(await last()).toBe('/resume.pdf');
});

test('each command button runs its command', async ({ page }) => {
  await openConsole(page);
  const button = (name: string) => page.getByRole('button', { name, exact: true });
  const press = (name: string) => printed(page, () => button(name).click());
  expect((await press('help'))[0]).toMatch(/^whoami\s+who this is$/);
  expect(await press('whoami')).toContain('Software engineer in Osaka. Seven years of Rails, Java and Linux at Vocera,');
  expect((await press('ls projects')).join('\n')).toMatch(/^sensei-connect\s+Next\.js/);
  expect((await press('resume')).at(-1)).toBe('→ opening the résumé (PDF) …');
  expect(await press('lamp')).toEqual(['lamp: off. The monitor is enough light anyway.']);
  // cd closes the console and moves the page instead of printing
  await button('cd work').click();
  await expect(con(page)).not.toHaveClass(/open/);
  await expect(page.locator('#work')).toBeInViewport({ timeout: 15_000 });
  await expect(page.locator('.side-shell [data-cwd]')).toHaveText('~/work');
});

test('Close and exit both close the console', async ({ page }) => {
  await openConsole(page);
  await page.locator('#console-close').click();
  await expect(con(page)).not.toHaveClass(/open/);
  await openConsole(page);
  await submit(page, 'exit');
  await expect(con(page)).not.toHaveClass(/open/);
});

test('arrow keys walk history in the console', async ({ page }) => {
  await openConsole(page);
  await run(page, 'whoami');
  await run(page, 'pwd');
  const input = page.locator('#console-input');
  await input.press('ArrowUp');
  await expect(input).toHaveValue('pwd');
  await input.press('ArrowUp');
  await expect(input).toHaveValue('whoami');
  await input.press('ArrowDown');
  await expect(input).toHaveValue('pwd');
});

test('lamp switches the real desk lamp', async ({ page }) => {
  // The desk only answers once WebGL is running, so this also proves the scene loaded
  await openConsole(page);
  expect(await run(page, 'lamp')).toEqual(['lamp: off. The monitor is enough light anyway.']);
  expect(await run(page, 'lamp')).toEqual(['lamp: on']);
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
