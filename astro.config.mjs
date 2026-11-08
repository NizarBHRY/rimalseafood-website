import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://rimalseafood.com',
  trailingSlash: 'never',
  build: { format: 'file' },
  integrations: [
    preact(),
    sitemap({ filter: (page) => !/\/(admin|404)/.test(page) }),
  ],
});
