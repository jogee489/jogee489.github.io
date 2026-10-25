import { defineConfig, devices } from '@playwright/test';

const PORT = 4329;

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // In CI, annotate failures on the run and keep an HTML report to download
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        // software WebGL, so the desk renders on machines without a GPU (CI included)
        launchOptions: {
          args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
          // a Chromium already on the machine, instead of the one `npx playwright install` downloads
          executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
        },
      },
    },
  ],
  // Tests run against the production build, not the dev server. CI has already built it.
  webServer: {
    // --ignore-lock keeps the server in the foreground, which Playwright needs: Astro 7 otherwise
    // starts it in the background when it thinks a coding agent is running it
    command: `${process.env.CI ? '' : 'npm run build && '}npm run preview -- --host 127.0.0.1 --port ${PORT} --ignore-lock`,
    // Locally, build the résumé from the saved export so runs don't depend on Google
    env: process.env.CI ? {} : { RESUME_HTML: 'tests/fixtures/resume-export.html' },
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
