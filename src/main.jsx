import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import { startSmoothScroll } from './lib/smoothScroll.js';

startSmoothScroll();

const root = document.getElementById('root');
const app = (
  <StrictMode>
    <App />
  </StrictMode>
);

// The build pre-renders the page into #root, so attach to that markup instead of redrawing it.
// In dev #root starts empty, so render from scratch.
if (root.hasChildNodes()) hydrateRoot(root, app);
else createRoot(root).render(app);
