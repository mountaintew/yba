// All page copy and rule data lives here, so editing text never means touching markup.

// Public files resolve from Vite's base path, so downloads and the demo still work if the site is hosted under a sub-path.
const BASE = import.meta.env.BASE_URL;
export const SITE_URL = 'https://yba.lesterantonio.dev';
export const DOWNLOAD = { href: `${BASE}yba-extension.zip`, filename: 'yba-extension.zip', size: '85 KB' };
export const DEMO_URL = `${BASE}extension/demo/slop.html`;

export const hero = {
  title: 'Spot what makes your site look AI-made',
  lead: "Yba is a free Chrome extension that checks the page you're on for 40 signs of AI-made design and copy, from Inter on every heading to a card inside a card. It previews each fix in place and writes the instructions your coding agent needs.",
  fine: `Free, ${DOWNLOAD.size}.`, // browser support is answered once, in the FAQ
};

export const how = {
  title: 'From the live page to your agent in three steps',
  intro: 'Its only output is a markdown report you paste into Claude Code, Cursor or any agent that edits your files.',
};

export const report = {
  title: 'The report names the element and the fix',
  body: 'Page-wide problems come first, so fonts and colours get fixed once in your tokens instead of on every div.',
};

export const rules = {
  title: '40 rules, grouped by where they show up',
  intro: "The rules come from impeccable's design laws, published lists of AI-default fonts, Wikipedia's guide to signs of AI writing, and WCAG 2.2.",
  groups: [
    ['Content', [['Remove filler badges'], ['Remove repeated labels'], ['Make headlines specific'], ['Rewrite AI-sounding text'], ['Make button text specific'], ['Remove long dashes'], ['Show the real product']]],
    ['Typography', [['Replace overused AI fonts'], ['Remove random italics'], ['Use code-style font only for code'], ['Make headings stand out'], ['Fix awkward line breaks'], ['Line up numbers'], ['Fine-tune alignment']]],
    ['Layout', [['Use consistent sizes'], ['Make the main thing bigger'], ['Use space instead of lines'], ['Remove boxes inside boxes'], ['Line up side-by-side text'], ['Match rounded corners']]],
    ['Colour & detail', [['Make one main button stand out'], ['Use one brand colour'], ['Soften pure black and white'], ['Make faint text readable'], ['Make icons match'], ['Remove glows and heavy shadows']]],
    ['Accessibility', [['Make buttons easy to tap'], ['Describe images'], ['Name icon-only buttons'], ['Stop images shifting the page']]],
    ['Responsive', [['Shrink big pictures on phones'], ['Stop sideways scrolling'], ['Make small text bigger']]],
    ['Banned patterns', [['Remove side stripes'], ['Thin out heavy borders'], ['Remove rainbow text'], ['Rethink big-number stats'], ['Vary repeated cards']]],
    ['Behaviour', [['Show loading progress'], ['Use helpful animation']]],
  ],
};

export const faq = {
  title: 'Questions before you install',
  // Each question has its own capybara; the picture crossfades to match the open question.
  items: [
    { q: 'Will it change my code?', a: 'Never. Previews are inline styles on the page in your browser, and a refresh puts everything back. Your agent edits the code, working from the report.',
      art: `${BASE}assets/faq/change-code-v2.webp`, alt: 'The capybara typing on a laptop.' },
    { q: 'Does it send my pages anywhere?', a: 'The extension makes zero network requests and has no account. It asks for three permissions: the active tab, script injection to show its panel, and local storage for the components you approve.',
      art: `${BASE}assets/faq/send-anywhere-v2.webp`, alt: 'The capybara holding a paper plane.' },
    { q: 'How accurate are the rules?', a: 'They are heuristics that read computed styles, so expect the odd false positive, which is why every fix is a preview you approve first.',
      art: `${BASE}assets/faq/rules-accuracy-v2.webp`, alt: 'The capybara in a beret, checking a clipboard through a magnifying glass.' },
    { q: 'Will it make my page look good?', a: 'It removes defaults that read as machine-made and points out what only a person can fix, like a vague headline. Your taste and your brand still decide how it looks.',
      art: `${BASE}assets/faq/look-good-v2.webp`, alt: 'The capybara in a beret, painting a web page.' },
    { q: 'Which browsers does it run in?', a: "Chrome, Edge, Arc, Brave, Opera and other Chromium browsers. Firefox and Safari aren't supported yet.",
      art: `${BASE}assets/faq/browser-run-v2.webp`, alt: 'The capybara juggling browser logos.' },
  ],
};

export const closing = {
  title: 'Clean up your next vibe-coded page',
  body: 'Until the store listing is live, it installs as an unpacked extension.',
  version: 'Yba v1.0',
};
