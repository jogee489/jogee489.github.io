// Drives the full-screen console the way a visitor does, for the end-to-end tests
import { expect, type Page } from '@playwright/test';

export const con = (page: Page) => page.locator('#console');

export async function openConsole(page: Page) {
  await page.keyboard.press('Backquote');
  await expect(con(page)).toHaveClass(/open/);
  await expect(page.locator('#console-input')).toBeFocused();
}

export async function submit(page: Page, cmd: string) {
  await page.locator('#console-input').fill(cmd);
  await page.locator('#console-input').press('Enter');
}

/** does something that runs one command (typing it, or clicking a button) and returns the lines it printed */
export async function printed(page: Page, action: () => Promise<unknown>) {
  const lines = page.locator('#console-out .ln');
  const prompts = page.locator('#console-out .ln.in');
  const before = await lines.count();
  const n = await prompts.count();
  await action();
  await expect(prompts).toHaveCount(n + 1);
  return (await lines.allTextContents()).slice(before + 1).map(s => s.replace(/ /g, ''));
}

/** records window.open calls instead of opening tabs; call before page.goto */
export const recordOpens = (page: Page) =>
  page.addInitScript(() => {
    const w = window as typeof window & { opened: string[] };
    w.opened = [];
    w.open = ((url: string) => { w.opened.push(url); return null; }) as typeof window.open;
  });

/** the links opened so far */
export const opened = (page: Page) => page.evaluate(() => (window as typeof window & { opened: string[] }).opened);

/** runs a command in the console and returns the lines it printed */
export const run = (page: Page, cmd: string) => printed(page, () => submit(page, cmd));
