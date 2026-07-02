# pluckor-website

Landing page + docs for **[Pluckor](https://www.npmjs.com/package/pluckor)** — give an AI
agent a real browser. Built with [Astro](https://astro.build); static output.

## Develop

```bash
pnpm install
pnpm dev        # http://localhost:4321
pnpm build      # → dist/
pnpm preview    # serve the built site
```

## Deploy (Vercel)

Static site, no adapter. On Vercel: **Framework preset** = Astro, **Build command**
`pnpm build`, **Output directory** `dist`. A `pnpm-lock.yaml` is committed for
reproducible installs.

## Structure

```
src/
  pages/
    index.astro          landing page
    docs/*.md            docs (getting-started, tools, plk, configuration,
                         how-it-works, cloudflare, recipes, skill)
  layouts/               Base.astro, Docs.astro
  components/            Header, Footer, HeroTerminal, InstallTabs, CopyCommand
  styles/global.css      design system (retro-futuristic warm CRT)
  docs-nav.ts            docs sidebar structure
public/                  favicon
```

MIT
