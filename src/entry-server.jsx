/* eslint-disable react-refresh/only-export-components -- build-time server entry, never hot-reloaded */
import { renderToString } from 'react-dom/server';
import App from './App.jsx';

export { faq, hero, SITE_URL, STORE_URL } from './content.js';

// Renders the page to HTML at build time, so crawlers and link previews get the full content.
export const render = () => renderToString(<App />);
