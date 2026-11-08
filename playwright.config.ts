import { defineConfig, devices } from '@playwright/test';

// Tests run against the production build (`astro preview`), in the locally
// installed Chrome, at a desktop and a phone size. Port 4329 so a running
// `npm run dev` (4321, with its dev toolbar) is never tested by mistake.
export default defineConfig({
  testDir: 'tests',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4329',
    channel: 'chrome',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], channel: 'chrome' } },
    { name: 'phone', use: { ...devices['Pixel 7'], channel: 'chrome' } },
  ],
  webServer: {
    command: 'npm run build && npm run preview -- --port 4329',
    url: 'http://localhost:4329',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
