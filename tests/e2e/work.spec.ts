// The Work section: which projects show, the featured one, and its click-to-load demo video.
import { expect, test, type Page } from '@playwright/test';

const VIDEO = 'ZxlBJATvUNM';
const WATCH = `https://www.youtube.com/watch?v=${VIDEO}`;
const YOUTUBE = /youtube|ytimg|googlevideo|ggpht/;

test.beforeEach(async ({ page }) => {
  await page.route('https://api.github.com/**', route => route.fulfill({ json: [] }));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, route => route.abort());
  // Stands in for the YouTube player, so these run offline
  await page.route('https://www.youtube-nocookie.com/**', route =>
    route.fulfill({ contentType: 'text/html', body: '<title>player</title><p>player</p>' }));
});

/** opens the page at Work and returns every URL it requested */
async function visit(page: Page) {
  const requests: string[] = [];
  page.on('request', r => requests.push(r.url()));
  await page.goto('/');
  await page.locator('#work').scrollIntoViewIfNeeded();
  return requests;
}

const play = (page: Page) => page.getByRole('button', { name: 'Play Sensei Connect demo video' });

test('Work shows the four projects, with Sensei Connect featured', async ({ page }) => {
  await visit(page);
  const feature = page.locator('#work .feature');
  await expect(feature.locator('h3')).toContainText('Sensei Connect');
  await expect(feature.locator('.status')).toHaveText('In development');
  await expect(feature).toContainText('Sole product owner and developer');
  // The repo is private, so it links to the demo instead of the source
  await expect(feature.getByRole('link', { name: 'Watch demo' })).toHaveAttribute('href', WATCH);
  await expect(feature.getByRole('link', { name: 'Source' })).toHaveCount(0);
  await expect(page.locator('#work .projects .n')).toHaveText([/Heartopia Hub/, /Weather Pet/, /Marvel Rivals Randomizer/]);
  await expect(page.locator('#work')).not.toContainText(/LEAP|Laser Defender|Lunch Roulette/);
});

test('nothing from YouTube loads until play is pressed', async ({ page }) => {
  const requests = await visit(page);
  await page.waitForLoadState('networkidle');
  await expect(page.locator('#work iframe')).toHaveCount(0);
  expect(requests.filter(u => YOUTUBE.test(u))).toEqual([]);
  // Without JavaScript the poster is a plain link to the video
  await expect(page.locator('.video-start')).toHaveAttribute('href', WATCH);
});

test('play loads the privacy-enhanced player in place', async ({ page }) => {
  await visit(page);
  await play(page).click();
  const frame = page.locator('#work iframe');
  await expect(frame).toHaveAttribute('src', new RegExp(`^https://www\\.youtube-nocookie\\.com/embed/${VIDEO}\\?autoplay=1`));
  await expect(frame).toHaveAttribute('title', 'Sensei Connect demo video');
  await expect(frame).toBeFocused();
  await expect(page.frameLocator('#work iframe').locator('p')).toHaveText('player');
  expect(page.context().pages()).toHaveLength(1);
});

for (const key of ['Enter', 'Space']) {
  test(`play works from the keyboard with ${key}`, async ({ page }) => {
    await visit(page);
    await play(page).focus();
    await page.keyboard.press(key);
    await expect(page.locator('#work iframe')).toHaveAttribute('title', 'Sensei Connect demo video');
  });
}

test.describe('at phone width', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('the video fits the screen and plays on tap', async ({ page }) => {
    await visit(page);
    const box = (await page.locator('.video').boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390);
    expect(box.height / box.width).toBeCloseTo(9 / 16, 2);
    await play(page).tap();
    await expect(page.locator('#work iframe')).toBeVisible();
  });
});
