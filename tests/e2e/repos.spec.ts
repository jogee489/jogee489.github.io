// The repo strip under "Everything else on GitHub": it drifts on its own, scrolls by hand
// (arrows, mouse drag, trackpad) and enlarges the card under the pointer.
import { expect, test, type Page } from '@playwright/test';

const repo = (name: string) => ({
  name, full_name: `jogee489/${name}`, html_url: `https://github.com/jogee489/${name}`, fork: false, default_branch: 'main',
});
const MANY = Array.from({ length: 12 }, (_, i) => repo(`repo-${i + 1}`));

async function load(page: Page, repos = MANY, still = false) {
  if (still) await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('https://api.github.com/**', route => route.fulfill({ json: repos }));
  await page.route('https://raw.githubusercontent.com/**', route => route.fulfill({ status: 404 }));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, route => route.abort());
  await page.route('https://github.com/**', route => route.fulfill({ body: 'repo' }));
  await page.goto('/');
  await page.locator('#repos').scrollIntoViewIfNeeded();
}

const strip = (page: Page) => page.locator('#repo-strip');
const scrollLeft = (page: Page) => strip(page).evaluate(el => el.scrollLeft);
/** card width plus gap, and the width of one copy of the list */
const sizes = (page: Page) => strip(page).evaluate(el => {
  const [a, b] = el.querySelectorAll<HTMLElement>('.repo');
  const pitch = b.offsetLeft - a.offsetLeft;
  return { pitch, span: pitch * (el.querySelectorAll('.repo').length / 3) };
});

// With reduced motion the strip doesn't drift and the arrows jump, so positions are exact
test.describe('without motion', () => {
  test('the arrows scroll by whole cards, both ways, and loop', async ({ page }) => {
    await load(page, MANY, true);
    const { pitch, span } = await sizes(page);
    const start = await scrollLeft(page);
    expect(start).toBe(span);  // the first card of the middle copy is on the left

    await page.getByRole('button', { name: 'Scroll repos forward' }).click();
    const fwd = await scrollLeft(page);
    expect(fwd - start).toBeGreaterThan(0);
    expect((fwd - start) % pitch).toBeCloseTo(0, 0);

    await page.getByRole('button', { name: 'Scroll repos back' }).click();
    expect(await scrollLeft(page)).toBe(start);

    // Going back from the first card wraps to the end instead of stopping
    await page.getByRole('button', { name: 'Scroll repos back' }).click();
    const back = await scrollLeft(page);
    expect(back).toBeGreaterThanOrEqual(span);
    expect(back).toBeLessThan(span * 2);
  });

  test('dragging scrolls the strip and does not open a repo', async ({ page }) => {
    await load(page, MANY, true);
    const before = await scrollLeft(page);
    const box = (await strip(page).boundingBox())!;
    const y = box.y + box.height / 2;
    await page.mouse.move(box.x + box.width * 0.7, y);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.5, y, { steps: 8 });
    await page.mouse.move(box.x + box.width * 0.3, y, { steps: 8 });
    await page.mouse.up();
    const moved = (await scrollLeft(page)) - before;
    expect(moved).toBeCloseTo(box.width * 0.4, -1);
    expect(page.context().pages()).toHaveLength(1);
  });

  test('a click still opens the repo', async ({ page }) => {
    await load(page, MANY, true);
    const popup = page.waitForEvent('popup');
    await page.locator('.repo:not([aria-hidden])').first().click();
    expect((await popup).url()).toBe('https://github.com/jogee489/repo-1');
  });
});

test('the strip drifts on its own and stops under the pointer', async ({ page }) => {
  await load(page);
  const a = await scrollLeft(page);
  // Headless software rendering manages only a few frames a second, so allow it time
  await expect.poll(() => scrollLeft(page), { timeout: 15_000 }).toBeGreaterThan(a + 2);

  await page.locator('.repo:not([aria-hidden])').nth(1).hover();
  await page.waitForTimeout(300);
  const b = await scrollLeft(page);
  await page.waitForTimeout(1500);
  expect(await scrollLeft(page)).toBe(b);
});

test('the hovered card gets bigger and stays inside the strip', async ({ page }) => {
  await load(page);
  const box = (await strip(page).boundingBox())!;
  const cards = page.locator('.repo');
  const small = (await cards.first().boundingBox())!;

  // The last card that is fully in view, right against the faded edge
  const edge = await strip(page).evaluate(el => {
    const right = el.scrollLeft + el.clientWidth;
    const all = [...el.querySelectorAll<HTMLElement>('.repo')];
    return all.findLastIndex(c => c.offsetLeft + c.offsetWidth <= right);
  });
  await cards.nth(edge).hover();
  const width = async () => (await cards.nth(edge).boundingBox())!.width;
  await expect.poll(async () => (await width()) / small.width, { timeout: 10_000 }).toBeCloseTo(1.3, 2);
  const big = (await cards.nth(edge).boundingBox())!;
  expect(big.x + big.width).toBeLessThanOrEqual(box.x + box.width + 1);
  expect(big.y).toBeGreaterThanOrEqual(box.y - 1);
  expect(big.y + big.height).toBeLessThanOrEqual(box.y + box.height + 1);
});

test('a short list sits still and shows each repo once', async ({ page }) => {
  await load(page, MANY.slice(0, 2));
  await expect(page.locator('.repo')).toHaveCount(2);
  await expect(page.getByRole('button', { name: 'Scroll repos forward' })).toHaveCount(0);
});
