// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

// Static site — deploys to Vercel (or any static host) with no adapter.
export default defineConfig({
  site: 'https://pluckor.com',
  integrations: [mdx(), sitemap()],
  redirects: {
    '/docs': '/docs/getting-started',
  },
  markdown: {
    shikiConfig: {
      theme: 'github-dark-default',
      wrap: false,
    },
  },
});
