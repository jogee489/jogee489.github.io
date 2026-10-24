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

/** runs a command in the console and returns the lines it printed */
export async function run(page: Page, cmd: string) {
  const lines = page.locator('#console-out .ln');
  const prompts = page.locator('#console-out .ln.in');
  const before = await lines.count();
  const n = await prompts.count();
  await submit(page, cmd);
  await expect(prompts).toHaveCount(n + 1);
  return (await lines.allTextContents()).slice(before + 1).map(s => s.replace(/ /g, ''));
}
