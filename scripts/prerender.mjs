// Puts the rendered page and its structured data into dist/index.html, then removes the server bundle.
import { readFile, rm, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const { render, faq, SITE_URL, STORE_URL } = await import(pathToFileURL(resolve(root, 'dist-ssr/entry-server.js')).href);

const json = (data) => JSON.stringify(data).replace(/</g, '\\u003c');
const structured = [
  {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Yba',
    description: 'An assistant for deslopping interfaces. A Chrome extension that finds what makes a page look AI-made, previews each fix on the live page, and writes instructions for your coding agent.',
    applicationCategory: 'DeveloperApplication',
    operatingSystem: 'Chrome, Edge, Arc, Brave, Opera',
    url: `${SITE_URL}/`,
    image: `${SITE_URL}/og-image.jpg`,
    installUrl: STORE_URL,
    downloadUrl: STORE_URL,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  },
  {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.items.map(({ q, a }) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
  },
];

const file = resolve(root, 'dist/index.html');
let html = await readFile(file, 'utf8');
if (!html.includes('<div id="root"></div>')) throw new Error('dist/index.html has no empty #root to fill');
html = html
  .replace('<div id="root"></div>', `<div id="root">${render()}</div>`)
  .replace('</head>', `${structured.map((d) => `  <script type="application/ld+json">${json(d)}</script>`).join('\n')}\n  </head>`);
await writeFile(file, html);
await rm(resolve(root, 'dist-ssr'), { recursive: true, force: true });
console.log('Pre-rendered dist/index.html');
