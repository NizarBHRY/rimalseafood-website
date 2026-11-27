import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://rimalseafood.com',
  trailingSlash: 'never',
  build: { format: 'file' },
  integrations: [
    // Two JSX frameworks: the site's islands are Preact; the motion
    // principles page (src/components/motion-lab) is React + Framer Motion.
    preact({ include: ['src/components/islands/**/*.tsx'] }),
    react({ include: ['src/components/motion-lab/**/*.{ts,tsx}'] }),
    sitemap({ filter: (page) => !/\/(admin|404|motion-principles)/.test(page) }),
  ],
  // Tailwind is imported only by the motion principles page's stylesheet,
  // so its reset never reaches the rest of the site.
  vite: { plugins: [tailwindcss()] },
});
