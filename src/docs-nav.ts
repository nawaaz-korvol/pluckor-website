export interface DocLink {
  href: string;
  label: string;
}
export interface DocGroup {
  title: string;
  items: DocLink[];
}

export const docsNav: DocGroup[] = [
  {
    title: 'Start',
    items: [
      { href: '/docs/getting-started/', label: 'Getting started' },
      { href: '/docs/skill/', label: 'The skill' },
    ],
  },
  {
    title: 'Reference',
    items: [
      { href: '/docs/tools/', label: 'Tools' },
      { href: '/docs/plk/', label: 'The plk CLI' },
      { href: '/docs/recovery/', label: 'Recovery' },
      { href: '/docs/configuration/', label: 'Configuration' },
    ],
  },
  {
    title: 'Concepts',
    items: [
      { href: '/docs/how-it-works/', label: 'How it works' },
      { href: '/docs/cloudflare/', label: 'Cloudflare & stealth' },
    ],
  },
  {
    title: 'Guides',
    items: [{ href: '/docs/recipes/', label: 'Recipes' }],
  },
];

// flat, ordered list for prev/next
export const docsOrder: DocLink[] = docsNav.flatMap((g) => g.items);
