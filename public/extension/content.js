/* Yba: hover a component, preview de-slopped styles, export agent instructions. */
(() => {
  if (window.__ybaLoaded) return;
  window.__ybaLoaded = true;

  // ───────────────────────── storage (chrome or localStorage for demo) ─────────────────────────
  const hasChrome = typeof chrome !== 'undefined' && !!chrome.runtime?.id;
  const STORE_KEY = 'yba:' + location.origin + location.pathname;
  const store = {
    async get() {
      try {
        if (hasChrome) return (await chrome.storage.local.get(STORE_KEY))[STORE_KEY] || [];
        return JSON.parse(localStorage.getItem(STORE_KEY) || '[]');
      } catch { return []; }
    },
    async set(v) {
      try {
        if (hasChrome) await chrome.storage.local.set({ [STORE_KEY]: v });
        else localStorage.setItem(STORE_KEY, JSON.stringify(v));
      } catch { /* storage unavailable */ }
    },
  };

  // Extension assets: chrome-extension:// URLs when installed, relative paths on the demo/landing pages.
  const assetURL = (f) => (hasChrome ? chrome.runtime.getURL('assets/' + f) : (window.__YBA_ASSETS__ || '../assets/') + f);

  // ───────────────────────── helpers ─────────────────────────
  const HOST_TAG = 'yba-ui';
  const cs = (el, pseudo) => getComputedStyle(el, pseudo);
  const px = (v) => parseFloat(v) || 0;
  const isOurs = (el) => el?.closest?.(HOST_TAG) || el?.tagName === HOST_TAG.toUpperCase();
  // Visually hidden screen-reader copies (.sr-only and friends) aren't on screen, so no rule should judge them.
  const SR_ONLY = '.sr-only,.visually-hidden,.screen-reader-text,.screenreader-only,.a11y-hidden';
  // While the bar is open it covers the top of the viewport. pushPage() moves pinned headers below it; anything it
  // missed (e.g. made fixed later by the page's own script) is hidden behind the bar, so it is left out of checking.
  // Refreshed before each scan, preview and audit.
  const BAR_H = 48;
  let barOpen = false, coveredByBar = [];
  function refreshCovered() {
    coveredByBar = !barOpen ? [] : [...document.querySelectorAll('body *')].filter((el) => {
      if (isOurs(el) || !/fixed|sticky/.test(getComputedStyle(el).position)) return false;
      const r = el.getBoundingClientRect();
      return r.height > 0 && r.top >= -1 && r.bottom <= BAR_H + 1;
    });
  }
  const underBar = (el) => coveredByBar.some((c) => c.contains(el));
  // While the bar is open the page is pushed down by BAR_H instead of being covered: <html> gets a top margin and
  // fixed/sticky elements pinned to the top move down with it. Inline values are saved and restored on close.
  let unpush = [];
  function pushPage(v) {
    unpush.forEach((undo) => undo()); unpush = [];
    if (!v) return;
    // Set an inline !important value and remember how to put the old inline value back.
    const set = (el, prop, val) => {
      const old = el.style.getPropertyValue(prop), pri = el.style.getPropertyPriority(prop);
      el.style.setProperty(prop, val, 'important');
      unpush.push(() => (old ? el.style.setProperty(prop, old, pri) : el.style.removeProperty(prop)));
    };
    const html = document.documentElement;
    set(html, 'margin-top', `calc(${getComputedStyle(html).marginTop} + ${BAR_H}px)`);
    for (const el of document.querySelectorAll('body *')) {
      if (isOurs(el)) continue;
      const st = getComputedStyle(el);
      if (!/fixed|sticky/.test(st.position) || st.top === 'auto') continue;
      if (!st.top.endsWith('px') || px(st.top) > BAR_H) continue; // only things pinned at (or near) the top edge
      set(el, 'top', `${px(st.top) + BAR_H}px`);
    }
  }

  const all = (root) => [root, ...root.querySelectorAll('*')].filter((el) => !isOurs(el) && !['SCRIPT', 'STYLE', 'LINK', 'META', 'NOSCRIPT'].includes(el.tagName) && !el.closest(SR_ONLY) && !underBar(el));
  const visible = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && cs(el).visibility !== 'hidden'; };
  const ownText = (el) => [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim();
  const words = (t) => t.split(/\s+/).filter(Boolean).length;
  const short = (t, n = 60) => { t = t.replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1) + '…' : t; };
  // Corner radius in px; percentages resolve against the smaller side (50% on a circle is half its width).
  const radiusPx = (el, st = cs(el)) => { const v = st.borderTopLeftRadius; if (!v.includes('%')) return px(v); const r = el.getBoundingClientRect(); return (parseFloat(v) / 100) * Math.min(r.width, r.height); };
  const isAutoMargin = (el, prop) => { try { return String(el.computedStyleMap().get(prop)) === 'auto'; } catch { return false; } };
  // Rendered lines of an element: each word's box, grouped by vertical position.
  function textLines(el) {
    const lines = [];
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const re = /\S+/g; let m;
      while ((m = re.exec(node.nodeValue))) {
        const range = document.createRange(); range.setStart(node, m.index); range.setEnd(node, m.index + m[0].length);
        const r = range.getClientRects()[0]; if (!r) continue;
        const last = lines[lines.length - 1];
        if (last && Math.abs(last.top - r.top) < r.height / 2) { last.words.push({ text: m[0], rect: r }); last.right = Math.max(last.right, r.right); }
        else lines.push({ top: r.top, right: r.right, words: [{ text: m[0], rect: r }] });
      }
    }
    return lines;
  }
  const isHeading = (el) => /^H[1-6]$/.test(el.tagName) || el.getAttribute('role') === 'heading';
  // Big text that is not nested inside another heading/big-text block (avoids counting <em> inside <h1> twice).
  const isHeadline = (el) => (isHeading(el) || px(cs(el).fontSize) >= 22) && !el.parentElement?.closest('h1,h2,h3,h4,h5,h6,[role=heading]') &&
    !(el.parentElement && px(cs(el.parentElement).fontSize) >= 22 && ownText(el.parentElement));
  const INTERACTIVE = 'a,button,input,select,textarea,summary,[role=button],[role=link],[role=tab]';
  const median = (arr) => { const s = [...arr].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };

  // Color parsing through canvas handles rgb/oklch/color()/named alike.
  const cv = document.createElement('canvas'); cv.width = cv.height = 1;
  const cx = cv.getContext('2d', { willReadFrequently: true });
  const colorCache = new Map();
  function rgba(c) {
    if (!c || c === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
    if (colorCache.has(c)) return colorCache.get(c);
    cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#000'; cx.fillStyle = c; cx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = cx.getImageData(0, 0, 1, 1).data;
    const out = { r, g, b, a: a / 255 };
    colorCache.set(c, out); return out;
  }
  const lum = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
  const sat = ({ r, g, b }) => { const mx = Math.max(r, g, b) / 255, mn = Math.min(r, g, b) / 255, l = (mx + mn) / 2; return mx === mn ? 0 : (mx - mn) / (1 - Math.abs(2 * l - 1)); };
  const mix = (a, b, t) => ({ r: Math.round(a.r + (b.r - a.r) * t), g: Math.round(a.g + (b.g - a.g) * t), b: Math.round(a.b + (b.b - a.b) * t) });
  const css = ({ r, g, b }) => `rgb(${r}, ${g}, ${b})`;
  // sRGB → OKLCH (for reporting accents and tinting neutrals toward the brand hue).
  function oklch({ r, g, b }) {
    const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    const [R, G, B] = [lin(r), lin(g), lin(b)];
    const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
    const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
    const s2 = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
    const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s2;
    const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s2;
    const Bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s2;
    return { L, C: Math.hypot(A, Bb), H: ((Math.atan2(Bb, A) * 180) / Math.PI + 360) % 360 };
  }
  const fmtOklch = (c) => { const o = oklch(rgba(c)); return `oklch(${(o.L * 100).toFixed(1)}% ${o.C.toFixed(3)} ${Math.round(o.H)})`; };

  function effectiveBg(el) {
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const s = cs(n);
      if (s.backgroundImage !== 'none') return null; // image/gradient: can't measure reliably
      const c = rgba(s.backgroundColor);
      if (c.a > 0.5) return c;
      // Positioned layers (overlay navs, badges on images) paint over whatever is beneath, not their DOM parent.
      if (/absolute|fixed|sticky/.test(s.position)) return paintedBg(el);
    }
    return { r: 255, g: 255, b: 255, a: 1 };
  }
  // Background actually painted under el's centre. Off-screen elements can't be probed, so they're skipped.
  function paintedBg(el) {
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    if (x < 0 || y < (barOpen ? BAR_H : 0) || x > innerWidth || y > innerHeight) return null; // under the bar: not visible
    for (const n of document.elementsFromPoint(x, y)) {
      if (isOurs(n) || el.contains(n)) continue;
      const s = cs(n);
      if (s.backgroundImage !== 'none') return null;
      const c = rgba(s.backgroundColor);
      if (c.a > 0.5) return c;
    }
    return null;
  }

  let accentCache = null;
  function accent() {
    if (accentCache) return accentCache;
    const counts = new Map();
    for (const el of document.querySelectorAll('a,button,[role=button]')) {
      if (isOurs(el)) continue;
      const s = cs(el);
      for (const c of [s.backgroundColor, s.color]) {
        const v = rgba(c);
        if (v.a < 0.6 || sat(v) < 0.4) continue;
        const l = lum(v); if (l < 0.03 || l > 0.7) continue;
        const k = css(v); counts.set(k, (counts.get(k) || 0) + 1);
      }
    }
    accentCache = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] || 'rgb(37, 99, 235)';
    return accentCache;
  }

  // ───────────────────────── rules ─────────────────────────
  // auto: true = full live preview · 'mark' = preview flags spots, agent does the real work
  const VAGUE = /\b(unlock|unleash|supercharge|seamless(ly)?|elevate|revolutioni[sz]e|empower|transform|next[- ]gen(eration)?|cutting[- ]edge|game[- ]chang|effortless(ly)?|reimagin|harness|the future of|all[- ]in[- ]one|powerful|magic(al)?|limitless|journey|world[- ]class|robust|synerg|delve|reimagin|redefin|next[- ]level|say goodbye|game[- ]?chang)/i;
  const EMOJI = /^\p{Extended_Pictographic}/u;
  // From research on AI-default typography: 'ai' = model/template defaults, 'generic' = overused 2010s defaults.
  const SLOP_FONTS = {
    inter: 'ai', 'inter var': 'ai', 'inter tight': 'ai', 'inter display': 'ai', geist: 'ai', 'geist sans': 'ai', 'space grotesk': 'ai',
    'plus jakarta sans': 'ai', 'dm sans': 'ai', manrope: 'ai', outfit: 'ai', 'instrument serif': 'ai', 'instrument sans': 'ai', fraunces: 'ai', syne: 'ai',
    poppins: 'generic', montserrat: 'generic', roboto: 'generic', 'open sans': 'generic', lato: 'generic', raleway: 'generic', nunito: 'generic',
  };
  const primaryFont = (el) => (cs(el).fontFamily.split(',')[0] || '').trim().replace(/^["']|["']$/g, '').toLowerCase().replace(/\s+variable$/, '');
  // Real-world guards: controls that look like buttons but aren't calls to action.
  const NOT_CTA = '[role=tab],[role=switch],[role=checkbox],[role=radio],[role=menuitem],[role=option],[aria-pressed],[aria-selected],[aria-checked],[aria-expanded]';
  function isActionButton(el) {
    if (!visible(el) || el.matches(NOT_CTA) || el.closest('[role=tablist],[role=menu],[role=toolbar],nav')) return false;
    const label = (el.innerText || el.value || '').trim();
    if (label.length < 2) return false; // icon-only buttons are tools, not CTAs
    if (/^skip\b/i.test(label) || el.getBoundingClientRect().bottom < 0) return false; // skip links and off-screen helpers
    if (el.matches('button,input[type=submit],input[type=button],[role=button]')) return true;
    if (el.tagName !== 'A') return false;
    const st = cs(el); return (rgba(st.backgroundColor).a > 0.1 || st.backgroundImage !== 'none' || px(st.borderTopWidth) > 0) && px(st.paddingLeft) >= 8;
  }
  const isFilled = (el) => { const st = cs(el); return rgba(st.backgroundColor).a > 0.3 || /gradient/.test(st.backgroundImage); };
  // A gradient laid over a photo or media keeps text readable; it's functional, not decoration.
  function isLegibilityOverlay(el) {
    const st = cs(el);
    if (/url\(/.test(st.backgroundImage)) return true;
    const host = el.parentElement; if (!host) return false;
    return /url\(/.test(cs(host).backgroundImage) || !!host.querySelector(':scope > img, :scope > video, :scope > picture, :scope > canvas');
  }
  // Split a computed box-shadow into layers; blur 0 = ring/hairline border (keep), blurred = glow/elevation.
  function shadowLayers(v) {
    if (!v || v === 'none') return [];
    return v.split(/,(?![^(]*\))/).map((l) => {
      const t = l.trim(); const nums = (t.replace(/(rgba?|oklch|hsla?|color)\([^)]*\)/g, '').match(/-?[\d.]+px/g) || []).map(px);
      return { text: t, inset: /\binset\b/.test(t), blur: nums[2] || 0 };
    });
  }
  const titleCase = (t) => t.replace(/\b\w/g, (m) => m.toUpperCase());

  const RULES = [
    {
      id: 'badges', label: 'Remove filler badges', hint: 'Little tags like “New” or “✨ AI-powered” that add nothing',
      agent: 'Remove decorative pill/badge elements that carry no real information (e.g. "New", "✨ AI-powered", "Beta", "Popular"). Keep a badge only if it reflects real state (e.g. an unread count).',
      auto: true,
      apply(root, c) {
        const gone = [];
        for (const el of all(root)) {
          if (el === root || gone.some((g) => g.contains(el)) || !visible(el)) continue;
          if (el.closest(INTERACTIVE)) continue;
          const t = el.textContent.trim(); if (!t || t.length > 28 || words(t) > 4 || el.children.length > 2) continue;
          const s = cs(el), r = el.getBoundingClientRect();
          const rad = px(s.borderTopLeftRadius);
          const pill = rad >= r.height / 2 - 2;
          const filled = rgba(s.backgroundColor).a > 0.05 || (s.borderTopStyle !== 'none' && px(s.borderTopWidth) > 0) || s.backgroundImage !== 'none';
          const small = r.height <= 36 && px(s.fontSize) <= 15;
          const keyword = /^(✨|🔥|🚀|⚡)?\s*(new|beta|ai|ai[- ]powered|hot|popular|trending|pro|now live|just launched|v\d)/i.test(t);
          if (small && filled && (pill || keyword)) { c.hide(el); gone.push(el); c.note(`Removed the “${short(t, 30)}” tag`); }
        }
        if (!gone.length) c.note('No filler tags found.');
      },
    },
    {
      id: 'labels', label: 'Remove repeated labels', hint: 'Small text near a heading that just repeats it',
      agent: 'Every word earns its place: remove eyebrow/overline labels, item counts pushed beside headings ("Typography  7"), captions that narrate the media below them ("Live demo. Click anything in it."), and intros that restate the heading or are obvious from context (e.g. "FEATURES" above a features heading, "Step 1" chips, "Learn more" duplicated next to a linked card).',
      auto: true,
      apply(root, c) {
        let n = 0; const done = new Set();
        for (const h of all(root).filter(isHeadline)) {
          let prev = h.previousElementSibling;
          if (!prev && h.parentElement !== root) prev = h.parentElement?.previousElementSibling;
          if (!prev || done.has(prev) || isOurs(prev) || !root.contains(prev) || prev.closest(INTERACTIVE)) continue;
          const t = prev.textContent.trim(); if (!t || words(t) > 5 || prev.querySelector('img,svg,video')) continue;
          const ps = cs(prev);
          const smaller = px(ps.fontSize) < px(cs(h).fontSize) * 0.7;
          const eyebrow = ps.textTransform === 'uppercase' || px(ps.letterSpacing) > 0.5 || (t === t.toUpperCase() && /[A-Z]/.test(t));
          if (smaller && eyebrow) { c.hide(prev); done.add(prev); n++; c.note(`Removed “${short(t, 30)}” above the heading`); }
        }
        // Counts tacked onto headings ("Typography  7"): a bare number, smaller or pushed away from the heading text.
        for (const h of all(root).filter(isHeading)) {
          for (const k of h.children) {
            const t = k.textContent.trim();
            if (!/^\(?\d{1,4}\)?$/.test(t) || done.has(k) || k.closest(INTERACTIVE)) continue;
            const ks = cs(k), hs = cs(h);
            const smaller = px(ks.fontSize) < px(hs.fontSize) * 0.85;
            const pushedAway = /space-between|space-around/.test(hs.justifyContent) || ks.marginLeft === 'auto' || ks.marginInlineStart === 'auto';
            if (!smaller && !pushedAway) continue;
            c.hide(k); done.add(k); n++;
            c.note(`Removed the number “${t}” next to “${short(ownText(h) || h.textContent.replace(t, ''), 24)}”`);
          }
        }
        // Captions that narrate the media right after them ("Live demo. Click anything in it." above an embed).
        const MEDIA = 'iframe,video,canvas,picture,img,[role=img],pre';
        const NARRATES = /\b(demo|preview|screenshot|example|excerpt|sample|video|below|above|shown|here|click|tap|scroll|try it|this (page|image|video|demo))\b/i;
        for (const el of all(root)) {
          if (done.has(el) || !visible(el) || el.tagName === 'LI' || el.closest(INTERACTIVE) || el.closest('figcaption')) continue;
          const t = (el.innerText || '').trim(); if (!t || words(t) > 25 || [...el.querySelectorAll(MEDIA)].some((m) => m.getBoundingClientRect().width >= 80)) continue;
          // Real media only: icons with role=img and list entries don't count.
          const bigEnough = (m) => { const r = m.getBoundingClientRect(); return r.width >= 80 && r.height >= 60; };
          const isMedia = (x) => !!x && [x, ...x.querySelectorAll(MEDIA)].some((m) => m.matches(MEDIA) && bigEnough(m));
          if (!isMedia(el.nextElementSibling) && !isMedia(el.previousElementSibling)) continue;
          const lead = el.querySelector('b,strong');
          const boldLead = !!lead && t.startsWith(lead.innerText.trim());
          if (!NARRATES.test(t) && !boldLead) continue;
          c.hide(el); done.add(el); n++;
          c.note(`Removed “${short(t, 40)}”, which only describes the picture`);
        }
        if (!n) c.note('No repeated labels found.');
      },
    },
    {
      id: 'italics', label: 'Remove random italics', hint: 'Words slanted for no reason',
      agent: 'Remove italic styling used for decorative emphasis on random words (e.g. <em>/<i> or font-style: italic inside headlines and body copy). Keep italics only for real semantic cases (titles of works, quotes, foreign terms).',
      auto: true,
      apply(root, c) {
        const hits = [];
        for (const el of all(root)) {
          if (cs(el).fontStyle !== 'italic' || el.closest('blockquote,cite,q')) continue;
          if (el.parentElement && cs(el.parentElement).fontStyle === 'italic' && root.contains(el.parentElement)) continue;
          c.set(el, 'font-style', 'normal'); hits.push(short(el.textContent, 24));
        }
        c.note(hits.length ? `Made upright: ${hits.slice(0, 5).map((h) => `“${h}”`).join(', ')}${hits.length > 5 ? '…' : ''}` : 'No random italics found.');
      },
    },
    {
      id: 'fonts', label: 'Replace overused AI fonts', hint: 'Fonts AI tools pick by default, like Inter',
      agent: 'Replace fonts that read as unchosen AI defaults with a deliberate pairing for this brand: a distinctive display face for headings and a readable text face for body. AI-default faces: Inter, Geist, Space Grotesk, Plus Jakarta Sans, DM Sans, Manrope, Outfit, and the trendy "anti-AI" swaps Instrument Serif, Fraunces, Syne. Generic 2010s defaults: Poppins, Montserrat, Roboto, Open Sans, Lato, Raleway, Nunito. Keep a default only if it was a conscious choice backed by the rest of the type system (scale, weight, spacing).',
      auto: true,
      apply(root, c) {
        const hits = new Map();
        const display = '"Iowan Old Style", Charter, "Palatino Linotype", Georgia, ui-serif, serif';
        const text = 'ui-sans-serif, -apple-system, "Segoe UI", system-ui, sans-serif';
        for (const el of all(root)) {
          if (!ownText(el)) continue;
          const fam = primaryFont(el); const tier = SLOP_FONTS[fam]; if (!tier) continue;
          if (!c.scan) c.set(el, 'font-family', isHeadline(el) || px(cs(el).fontSize) >= 22 ? display : text);
          else c.set(el);
          const k = `${fam}|${tier}`; hits.set(k, (hits.get(k) || 0) + 1);
        }
        for (const [k, n] of hits) { const [fam, tier] = k.split('|'); c.note(`${titleCase(fam)} is ${tier === 'ai' ? 'a common AI default' : 'an overused default'} (used in ${n} place${n > 1 ? 's' : ''})`); }
        if (!hits.size) c.note('No overused fonts found.');
        else if (!c.scan) c.note('The preview swaps in other fonts so you can compare. Your agent picks the final ones.');
      },
    },
    {
      id: 'mono', label: 'Use code-style font only for code', hint: 'Typewriter-style text used just for looks',
      agent: 'Use the monospace font only for code, keys, IDs, and tabular technical values. Switch decorative monospace labels, headings, and body text back to the primary sans/serif face.',
      auto: true,
      apply(root, c) {
        const body = cs(document.body).fontFamily;
        const fallback = /mono|courier|consolas|menlo|monaco/i.test(body) ? 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif' : body;
        let n = 0;
        for (const el of all(root)) {
          if (!/mono|courier|consolas|menlo|monaco|\bcode\b/i.test(cs(el).fontFamily)) continue;
          if (el.closest('code,pre,kbd,samp,var')) continue;
          const t = ownText(el); if (!t) continue;
          if (/[{}();=<>_$]|^\d+(\.\d+){1,}|^[#@][\w-]+$|^[A-F0-9-]{8,}$/i.test(t)) continue; // looks like code/data
          c.set(el, 'font-family', fallback); n++;
        }
        c.note(n ? `Changed ${n} bit${n > 1 ? 's' : ''} of code-style text to the normal font.` : 'Code-style font is only used for code.');
      },
    },
    {
      id: 'system', label: 'Use consistent sizes', hint: 'Text sizes, gaps and corners with no pattern',
      agent: 'Replace one-off values with design tokens: a single type scale (12/14/16/18/20/24/30/36/48/60), a 4px spacing grid, and a small radius set (4/8/12/16/full). Use one font family for UI text and keep a ≥1.25 ratio between type steps. Prefer existing tokens/components in the codebase over new values.',
      auto: true,
      apply(root, c) {
        const TYPE = [12, 14, 16, 18, 20, 24, 30, 36, 48, 60, 72];
        const RAD = [0, 4, 8, 12, 16];
        const near = (v, set) => set.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a));
        let f = 0, s = 0, r = 0;
        const families = new Map();
        for (const el of all(root)) if (ownText(el)) { const ff = cs(el).fontFamily; if (!/mono|courier|consolas|menlo/i.test(ff)) families.set(ff, (families.get(ff) || 0) + 1); }
        const pairing = [...families].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([f]) => f); // display + text faces are a system
        const mainFamily = pairing[0];
        for (const el of all(root)) {
          const st = cs(el);
          if (ownText(el)) {
            const fs = px(st.fontSize), t = near(fs, TYPE);
            if (Math.abs(fs - t) > 0.5) { c.set(el, 'font-size', t + 'px'); f++; }
            if (mainFamily && !pairing.includes(st.fontFamily) && !/mono|courier|consolas|menlo/i.test(st.fontFamily)) c.set(el, 'font-family', mainFamily);
          }
          for (const p of ['padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'margin-top', 'margin-bottom', 'row-gap', 'column-gap']) {
            const v = px(st.getPropertyValue(p)); if (!v || v < 0 || (p.startsWith('margin') && isAutoMargin(el, p))) continue;
            const t = Math.round(v / 4) * 4; if (Math.abs(v - t) > 0.5) { c.set(el, p, t + 'px'); s++; }
          }
          const rad = radiusPx(el, st);
          if (rad > 0) {
            const box = el.getBoundingClientRect();
            const isPill = rad >= Math.min(box.width, box.height) / 2 - 1;
            if (!isPill) { const t = near(rad, RAD); if (Math.abs(rad - t) > 0.5) { c.set(el, 'border-radius', t + 'px'); r++; } }
          }
        }
        c.note(f || s || r ? `Evened out ${f} text size${f === 1 ? '' : 's'}, ${s} gap${s === 1 ? '' : 's'} and ${r} rounded corner${r === 1 ? '' : 's'}.` : 'Sizes already follow a consistent pattern.');
      },
    },
    {
      id: 'product', label: 'Show the real product', hint: 'Decorative art where a screenshot would help more',
      agent: 'Replace abstract illustrations, 3D blobs, stock imagery, and generic icons-as-hero with real screenshots, short recordings, or live embeds of the actual product doing the thing the copy describes.',
      auto: 'mark',
      apply(root, c) {
        const shown = root.querySelector('iframe, video, img[alt*=screenshot i], img[alt*=product i], img[alt*=demo i]');
        if (shown) return c.note('The page already shows the real product, so illustrations can stay.');
        let n = 0;
        for (const el of all(root)) {
          if (!visible(el)) continue;
          const r = el.getBoundingClientRect();
          const big = r.width >= 80 && r.height >= 80;
          const isArt = (el.tagName === 'svg' && big && !el.closest('svg svg')) ||
            (el.tagName === 'IMG' && big && /illustration|abstract|hero|blob|3d|stock|placeholder|unsplash/i.test(el.alt + ' ' + el.src)) ||
            (big && el !== root && /url\(/.test(cs(el).backgroundImage) && !ownText(el));
          if (isArt) { c.mark(el, 'Swap for a real screenshot'); n++; }
        }
        c.note(n ? `Marked ${n} decorative picture${n > 1 ? 's' : ''} to swap for real screenshots.` : 'No decorative pictures found. Check the page shows the real product.');
      },
    },
    {
      id: 'enlarge', label: 'Make the main thing bigger', hint: 'Nothing stands out as most important',
      agent: 'Make the single most important element (the key headline, number, or product visual) clearly dominant: larger, heavier, more space around it. Reduce competing elements of similar size.',
      auto: true,
      apply(root, c) {
        let best = null, bestSize = 0;
        for (const el of all(root)) {
          if (!ownText(el) || !visible(el)) continue;
          const fs = px(cs(el).fontSize); if (fs > bestSize) { bestSize = fs; best = el; }
        }
        if (!best) return c.note('No text here.');
        // Judge whole headings and paragraphs: word-by-word animation splits one heading into many same-size spans.
        const blockOf = (el) => el.closest('h1,h2,h3,h4,h5,h6,p,li,figcaption,blockquote,button,a') || el;
        best = blockOf(best);
        const runnerUp = Math.max(0, ...all(root).filter((el) => ownText(el) && visible(el) && !best.contains(el)).map((el) => px(cs(el).fontSize)));
        if (runnerUp && bestSize >= runnerUp * 1.4) return c.note(`“${short(best.textContent, 30)}” already stands out the most.`);
        const next = Math.round(bestSize * 1.3);
        c.set(best, 'font-size', next + 'px'); c.set(best, 'line-height', '1.1');
        if (px(cs(best).fontWeight) < 600) c.set(best, 'font-weight', '650');
        c.note(`Made “${short(best.textContent, 30)}” bigger so it stands out.`);
      },
    },
    {
      id: 'group', label: 'Use space instead of lines', hint: 'Boxes and divider lines where space would do',
      agent: 'Group related content with whitespace rather than cards, borders, and divider lines. Not everything needs a container. Use larger gaps between groups and tighter gaps within a group, and vary spacing for rhythm instead of the same padding everywhere.',
      auto: true,
      apply(root, c) {
        let d = 0, b = 0, g = 0;
        for (const el of all(root)) {
          if (el === root) continue;
          const st = cs(el), r = el.getBoundingClientRect();
          if (el.tagName === 'HR' || (!el.children.length && !el.textContent.trim() && r.height <= 2 && r.width > 24 && (rgba(st.backgroundColor).a > 0 || px(st.borderTopWidth) > 0))) { c.hide(el); d++; continue; }
          if (el.closest(INTERACTIVE)) continue;
          const bordered = ['Top', 'Right', 'Bottom', 'Left'].some((s) => st[`border${s}Style`] !== 'none' && px(st[`border${s}Width`]) > 0);
          if (bordered && el.children.length && !/^(INPUT|TEXTAREA|SELECT|TABLE|TD|TH|TR)$/.test(el.tagName)) {
            c.set(el, 'border-color', 'transparent'); c.set(el, 'box-shadow', 'none'); b++;
          }
        }
        for (const el of all(root)) {
          const st = cs(el);
          if (!/flex|grid/.test(st.display) || el.children.length < 2) continue;
          const rowFlow = st.display.includes('flex') ? !st.flexDirection.startsWith('column') : false;
          const gap = st.display.includes('grid') ? Math.max(px(st.rowGap), px(st.columnGap)) : px(rowFlow ? st.columnGap : st.rowGap);
          if (!gap || gap >= 12) continue; // no gap may be intentional; 12px+ already separates groups
          const next = Math.max(16, Math.round((gap * 1.5) / 4) * 4);
          c.set(el, 'gap', next + 'px'); g++;
        }
        c.note(d || b || g ? [d && `removed ${d} divider line${d > 1 ? 's' : ''}`, b && `removed ${b} box outline${b > 1 ? 's' : ''}`, g && `added space in ${g} place${g > 1 ? 's' : ''}`].filter(Boolean).join(', ').replace(/^./, (m) => m.toUpperCase()) + '.' : 'Already uses space well.');
      },
    },
    {
      id: 'headlines', label: 'Make headlines specific', hint: 'Vague hype like “Unlock your potential”',
      agent: 'Rewrite vague, hype-y headlines ("Unlock the power of…", "Supercharge your workflow") into specific statements of what the product does for whom, ideally with a concrete number or noun.',
      auto: 'mark',
      apply(root, c) {
        let n = 0;
        for (const el of all(root)) {
          if (!isHeadline(el) || (!ownText(el) && !isHeading(el))) continue;
          const t = el.textContent.trim(); if (!t) continue;
          if (VAGUE.test(t)) { c.mark(el, 'Vague headline · rewrite'); n++; c.note(`“${short(t, 50)}” is vague`); }
        }
        if (!n) c.note('Headlines look specific. Check they say what the product does.');
      },
    },
    {
      id: 'cta', label: 'Make one main button stand out', hint: 'Several buttons competing for attention',
      agent: 'Make one primary call to action visually dominant (solid accent fill, strong weight). Demote secondary actions to ghost/text buttons. Never present two equal-weight primary buttons side by side.',
      auto: true,
      apply(root, c) {
        const btns = all(root).filter(isActionButton).filter((el, _, arr) => !arr.some((o) => o !== el && o.contains(el)));
        if (!btns.length) return c.note('No main buttons here.');
        // Prefer the button the design already treats as primary: the biggest filled one.
        const area = (el) => { const r = el.getBoundingClientRect(); return r.width * r.height; };
        const filled = btns.filter(isFilled);
        const primary = filled.length ? filled.sort((x, y) => area(y) - area(x))[0] : btns[0];
        // A repeat of the primary (same destination or same label) isn't competition. Placeholder links (#, empty,
        // javascript:) say nothing about the destination, so only the label counts for them.
        const realHref = (el) => { const h = (el.getAttribute('href') || '').trim(); return h && h !== '#' && !h.startsWith('javascript:') ? el.href : null; };
        const sameAction = (b) => (realHref(b) && realHref(b) === realHref(primary)) || b.innerText.trim() === primary.innerText.trim();
        const rest = btns.filter((b) => b !== primary && isFilled(b) && !sameAction(b)); // ghost buttons are quiet; repeats of the primary are fine
        if (!rest.length && isFilled(primary)) return c.note(`“${short(primary.innerText, 24)}” already stands out as the main button.`);
        const a = accent();
        c.set(primary, 'background-color', a); c.set(primary, 'background-image', 'none');
        c.set(primary, 'color', `oklch(98.5% 0.006 ${Math.round(oklch(rgba(a)).H)})`); c.set(primary, 'font-weight', '600');
        c.set(primary, 'border-color', 'transparent'); c.set(primary, 'box-shadow', 'none');
        for (const b of rest) {
          c.set(b, 'background-color', 'transparent'); c.set(b, 'background-image', 'none'); c.set(b, 'box-shadow', 'none');
          c.set(b, 'border', '1px solid rgba(127,127,127,.35)'); c.set(b, 'color', 'inherit');
        }
        c.note(`Made “${short(primary.textContent || primary.value, 24)}” the main button${rest.length ? ` and toned down ${rest.length} other${rest.length > 1 ? 's' : ''}` : ''}.`);
      },
    },
    {
      id: 'accent', label: 'Use one brand colour', hint: 'Rainbow gradients instead of one clear colour',
      agent: 'Use a Restrained colour strategy unless the brand calls for more: tinted neutrals plus one accent used on at most ~10% of the surface (primary actions, links, key highlights). Define colours in OKLCH. Replace rainbow/purple-blue gradient backgrounds with the solid accent or neutrals.',
      auto: true,
      apply(root, c) {
        const a = accent(); let g = 0, t = 0;
        for (const el of all(root)) {
          const st = cs(el);
          if (!/gradient/.test(st.backgroundImage)) continue;
          if (isLegibilityOverlay(el)) continue;
          const clipText = st.webkitBackgroundClip === 'text' || st.backgroundClip === 'text';
          if (clipText && c.has('gradtext')) continue; // dedicated rule handles it
          if (!clipText && isActionButton(el)) {
            // Keep buttons looking like buttons: swap the gradient for one solid brand colour.
            c.set(el, 'background-image', 'none'); c.set(el, 'background-color', a);
            c.set(el, 'color', `oklch(98.5% 0.006 ${Math.round(oklch(rgba(a)).H)})`); g++; continue;
          }
          if (clipText) { c.set(el, 'background-image', 'none'); c.set(el, '-webkit-text-fill-color', 'currentColor'); c.set(el, 'color', a); t++; }
          else { c.set(el, 'background-image', 'none'); g++; }
        }
        let links = 0;
        if (!c.scan) for (const el of root.querySelectorAll('a')) {
          if (el.closest('button,nav,header nav,[role=tablist],[role=menu]') || !el.closest('p,li,td,dd,blockquote,figcaption') || rgba(cs(el).backgroundColor).a >= 0.1) continue;
          const bg = effectiveBg(el); if (bg && contrast(rgba(a), bg) < 4.5) continue; // would become unreadable
          c.set(el, 'color', a); links++;
        }
        if (links) c.note(`Used the brand colour on ${links} link${links > 1 ? 's' : ''}.`);
        c.note(t || g ? `Replaced ${t} rainbow text and ${g} rainbow background${g === 1 ? '' : 's'} with one colour.` : 'No rainbow colours found.');
      },
    },
    {
      id: 'icons', label: 'Make icons match', hint: 'Icons in different sizes, or emoji used as icons',
      agent: 'Use icons from a single icon set at one consistent size and stroke weight per context. Replace emoji used as icons with icons from that set.',
      auto: true,
      apply(root, c) {
        const icons = all(root).filter((el) => {
          const r = el.getBoundingClientRect();
          if (el.tagName !== 'svg' || el.parentElement?.closest('svg')) return false;
          if (el.getAttribute('role') === 'img' || el.hasAttribute('aria-label') || el.closest('[class*=logo],[aria-label*=logo i]')) return false; // logos keep their size
          const ratio = r.width / (r.height || 1);
          return r.width > 0 && r.width <= 32 && r.height <= 32 && ratio > 0.8 && ratio < 1.25;
        });
        let e = 0;
        for (const el of all(root)) {
          const t = el.textContent.trim();
          if (el.children.length === 0 && t.length <= 4 && EMOJI.test(t)) { c.mark(el, 'Emoji used as an icon'); e++; }
        }
        if (icons.length && !c.scan) {
          const size = Math.round(median(icons.map((i) => i.getBoundingClientRect().width)));
          for (const i of icons) {
            c.set(i, 'width', size + 'px'); c.set(i, 'height', size + 'px'); c.set(i, 'flex-shrink', '0');
            if (i.tagName === 'svg' && (i.getAttribute('stroke') || i.querySelector('[stroke]'))) c.set(i, 'stroke-width', '1.75');
          }
          c.note(`Made ${icons.length} icons the same size.`);
        }
        if (e) c.note(`Marked ${e} emoji used as icons.`);
        if (!icons.length && !e) c.note('No icons here.');
      },
    },
    {
      id: 'embellish', label: 'Remove glows and heavy shadows', hint: 'Decoration that adds noise, like blur and glow',
      agent: 'Remove decorative effects: glows, coloured/heavy drop shadows, blurred background blobs, text shadows, and decorative ::before/::after shapes. Glassmorphism (backdrop-filter blur) only where it is rare and purposeful, never as the default card style. Keep at most one subtle elevation shadow where it aids layering.',
      auto: true,
      apply(root, c) {
        let n = 0;
        for (const el of all(root)) {
          const st = cs(el);
          const r = el.getBoundingClientRect();
          const decorative = el !== root && !el.textContent.trim() && !el.querySelector('img,svg,video,canvas,input') &&
            (st.position === 'absolute' || st.position === 'fixed') &&
            (/blur/.test(st.filter) || /gradient/.test(st.backgroundImage) || el.getAttribute('aria-hidden') === 'true') && r.width > 24 && !isLegibilityOverlay(el);
          if (decorative) { c.hide(el); n++; continue; }
          if (st.boxShadow !== 'none') {
            const layers = shadowLayers(st.boxShadow);
            const keep = layers.filter((l) => l.inset || l.blur === 0).map((l) => l.text); // rings, hairlines, focus rings
            const blurred = layers.length - keep.length;
            if (blurred) {
              if (el === root) keep.push('0 1px 2px rgba(0,0,0,.06)');
              c.set(el, 'box-shadow', keep.length ? keep.join(', ') : 'none'); n++;
            }
          }
          if (st.textShadow !== 'none') { c.set(el, 'text-shadow', 'none'); n++; }
          if (st.filter !== 'none' && /blur|drop-shadow|brightness|saturate/.test(st.filter)) { c.set(el, 'filter', 'none'); n++; }
          if (st.backdropFilter && st.backdropFilter !== 'none') { c.set(el, 'backdrop-filter', 'none'); c.set(el, '-webkit-backdrop-filter', 'none'); n++; }
          for (const p of ['::before', '::after']) {
            const ps = cs(el, p);
            if (ps.content === 'none' || ps.content === 'normal') continue;
            if (/gradient/.test(ps.backgroundImage) || /blur/.test(ps.filter) || ps.boxShadow !== 'none') {
              c.attr(el, 'data-yba-nopseudo-' + p.slice(2), ''); n++;
            }
          }
        }
        c.css(() => '[data-yba-nopseudo-before]::before,[data-yba-nopseudo-after]::after{display:none!important}');
        c.note(n ? `Removed ${n} glow${n > 1 ? 's' : ''}, shadow${n > 1 ? 's' : ''} or blur${n > 1 ? 's' : ''}.` : 'No glows or heavy shadows found.');
      },
    },
    {
      id: 'toprow', label: 'Line up side-by-side text', hint: 'Text beside a heading that sinks to the bottom',
      agent: 'When a heading and a paragraph sit side by side, align the row to the top or the centre. Bottom or baseline alignment pushes the shorter block down to the taller one\'s last line, where it reads as an afterthought.',
      auto: true,
      apply(root, c) {
        let n = 0;
        for (const el of all(root)) {
          const st = cs(el);
          if (!/flex|grid/.test(st.display) || !/end|baseline/.test(st.alignItems)) continue; // top and centre are both deliberate choices
          const kids = [...el.children].filter((k) => visible(k) && k.textContent.trim());
          if (kids.length < 2) continue;
          const rs = kids.map((k) => k.getBoundingClientRect());
          const sideBySide = rs.every((r, i) => i === 0 || (r.left >= rs[i - 1].right - 1 && r.top < rs[i - 1].bottom));
          const hasHeading = kids.some((k) => isHeading(k) || k.querySelector('h1,h2,h3,h4,h5,h6'));
          const hasText = kids.some((k) => k.tagName === 'P' || k.querySelector('p'));
          if (!sideBySide || !hasHeading || !hasText) continue;
          const drift = Math.max(...rs.map((r) => r.top)) - Math.min(...rs.map((r) => r.top));
          if (drift < 6) continue;
          c.set(el, 'align-items', 'start'); n++;
          c.note(`“${short(el.textContent, 28)}” sat lower than its heading. Lined them up.`);
        }
        if (!n) c.note('Side-by-side text lines up.');
      },
    },
    {
      id: 'radius', label: 'Match rounded corners', hint: 'Rounded boxes inside rounded boxes that don’t fit',
      agent: 'Make nested corner radii concentric: inner radius = outer radius − the gap (padding) between the two edges. Avoid inner elements with the same or larger radius than their container.',
      auto: true,
      apply(root, c) {
        let n = 0;
        for (const outer of all(root)) {
          const R = radiusPx(outer); if (!R) continue;
          const o = outer.getBoundingClientRect();
          if (R >= Math.min(o.width, o.height) / 2 - 1) continue; // pills
          for (const inner of outer.querySelectorAll('*')) {
            const ir = radiusPx(inner); if (!ir || isOurs(inner)) continue;
            const i = inner.getBoundingClientRect();
            if (ir >= Math.min(i.width, i.height) / 2 - 1) continue;
            const gap = Math.min(i.left - o.left, i.top - o.top, o.right - i.right, o.bottom - i.bottom);
            if (gap < 0 || gap > R * 2) continue;
            // R − gap, floored at 4px so padding ≥ radius doesn't produce harsh square corners.
            const target = Math.min(ir, Math.max(Math.round(R - gap), 4));
            if (ir - target >= 1) { c.set(inner, 'border-radius', target + 'px'); n++; }
          }
        }
        c.note(n ? `Matched ${n} rounded corner${n > 1 ? 's' : ''} to the box${n > 1 ? 'es' : ''} around ${n > 1 ? 'them' : 'it'}.` : 'Rounded corners already fit.');
      },
    },
    {
      id: 'contrast', label: 'Make faint text readable', hint: 'Text too light or too dark to read easily',
      agent: 'Raise text contrast to at least WCAG AA (4.5:1 for body, 3:1 for large text ≥24px or ≥18.66px bold). Replace low-contrast greys on light backgrounds and dim text on dark backgrounds with tokenised text colours.',
      auto: true,
      apply(root, c) {
        let n = 0, skipped = 0;
        for (const el of all(root)) {
          if (!ownText(el) || !visible(el)) continue;
          const st = cs(el); const fg = rgba(st.color); if (fg.a === 0) continue;
          const bg = effectiveBg(el); if (!bg) { skipped++; continue; }
          const fs = px(st.fontSize), large = fs >= 24 || (fs >= 18.66 && px(st.fontWeight) >= 700);
          const target = large ? 3 : 4.5;
          const before = contrast(fg, bg); if (before >= target) continue;
          const toward = lum(bg) > 0.4 ? { r: 0, g: 0, b: 0 } : { r: 255, g: 255, b: 255 };
          let t = 0, col = fg; while (contrast(col, bg) < target && t < 1) { t += 0.05; col = mix(fg, toward, t); }
          c.set(el, 'color', css(col)); n++;
          // Plain language for people using the extension; the WCAG targets live in the agent instructions.
          if (n <= 4) c.note(`“${short(ownText(el), 22)}” was hard to read. Made it ${toward.r ? 'lighter' : 'darker'}.`);
        }
        if (!n) c.note('All text is easy to read.');
        else if (n > 4) c.note(`…and ${n - 4} more.`);
        if (skipped) c.note(`${skipped} bit${skipped > 1 ? 's' : ''} of text sit${skipped > 1 ? '' : 's'} on images, so ${skipped > 1 ? 'they weren’t' : 'it wasn’t'} checked.`);
      },
    },
    {
      id: 'wrap', label: 'Fix awkward line breaks', hint: 'Headings with one lonely word on the last line',
      agent: 'Use `text-wrap: balance` on headings and `text-wrap: pretty` on paragraphs so lines are even and no single word is left orphaned. If balance pushes a conjunction ("and", "or") down to start a line it would have fitted on, use `pretty` on that heading instead. Constrain headline width (~20ch) and cap body line length at 65–75ch.',
      auto: true,
      apply(root, c) {
        let h = 0, p = 0;
        for (const el of all(root)) {
          if (!el.textContent.trim() || el.closest('pre,code,kbd')) continue;
          const lh = px(cs(el).lineHeight) || px(cs(el).fontSize) * 1.3;
          if (el.getBoundingClientRect().height < lh * 1.6) continue; // single line: nothing to balance
          const tw = cs(el).textWrapStyle || cs(el).textWrap || '';
          if (isHeadline(el)) {
            if (!/balance|pretty/.test(tw)) { c.set(el, 'text-wrap', 'balance'); h++; continue; }
            // Balance evens line lengths and can push "and" down even when the line above has room for it.
            if (/balance/.test(tw)) {
              const lines = textLines(el), st = cs(el);
              const contentRight = el.getBoundingClientRect().right - px(st.paddingRight);
              const space = px(st.fontSize) * 0.3;
              for (let i = 1; i < lines.length; i++) {
                const first = lines[i].words[0];
                if (!/^(and|or|but|nor|&)$/i.test(first.text)) continue;
                if (lines[i - 1].right + space + first.rect.width <= contentRight) {
                  c.set(el, 'text-wrap', 'pretty'); h++;
                  c.note(`“${first.text}” fitted on the line above in “${short(el.textContent, 30)}”, so the heading now wraps more naturally`);
                  break;
                }
              }
            }
          }
          else if (el.tagName === 'P' || (ownText(el) && words(ownText(el)) > 12)) { if (/balance|pretty/.test(tw) && el.getBoundingClientRect().width / (px(cs(el).fontSize) * 0.5) <= 75) continue; c.set(el, 'text-wrap', 'pretty'); if (el.getBoundingClientRect().width / (px(cs(el).fontSize) * 0.5) > 75) { c.set(el, 'max-width', '70ch'); c.note(`Made “${short(el.textContent, 24)}” narrower so the lines are easier to read`); } p++; }
        }
        c.note(h || p ? `Evened out line breaks in ${h} heading${h === 1 ? '' : 's'} and ${p} paragraph${p === 1 ? '' : 's'}.` : 'Line breaks already look good.');
      },
    },
    {
      id: 'optical', label: 'Fine-tune alignment', hint: 'Big text and icons that look slightly off',
      agent: 'Apply optical alignment: pull large headlines slightly left (~-0.05em) so their glyphs line up with body text, tighten letter-spacing on display sizes, vertically centre icons with text, and trim the icon-side padding of icon+label buttons.',
      auto: true,
      apply(root, c) {
        let n = 0;
        for (const el of all(root)) {
          const st = cs(el);
          if (ownText(el) && px(st.fontSize) >= 32 && !(px(st.letterSpacing) < 0)) {
            if (/start|left/.test(st.textAlign)) c.set(el, 'margin-left', `calc(${st.marginLeft} - 0.05em)`);
            if (st.letterSpacing === 'normal' || px(st.letterSpacing) >= 0) c.set(el, 'letter-spacing', '-0.02em');
            n++;
          }
          // Numbers in circles: old-style figures sit low and look off-centre even when the box is mathematically centred.
          const circle = (w, h, rad) => w > 0 && w <= 64 && Math.abs(w - h) <= 1 && rad >= w / 2 - 1;
          const r0 = el.getBoundingClientRect();
          if (/^\d{1,3}$/.test(ownText(el)) && circle(r0.width, r0.height, radiusPx(el, st)) && !/lining/.test(st.fontVariantNumeric)) {
            c.set(el, 'font-variant-numeric', 'lining-nums tabular-nums'); c.set(el, 'line-height', '1'); n++; c.note(`Centred number “${ownText(el)}” in its circle`);
          }
          for (const p of ['::before', '::after']) {
            const ps = cs(el, p);
            if (!/counter|^"\d{1,3}"$/.test(ps.content) || !circle(px(ps.width), px(ps.height), px(ps.borderTopLeftRadius)) || /lining/.test(ps.fontVariantNumeric)) continue;
            c.attr(el, 'data-yba-num-' + p.slice(2), ''); n++;
            if (n <= 6) c.note(`Centred the number in its circle next to “${short(el.textContent, 22)}”`);
          }
          if (el.matches(INTERACTIVE) && el.querySelector(':scope > svg, :scope > img') && ownText(el) && st.alignItems !== 'center') {
            if (!/flex/.test(st.display)) c.set(el, 'display', 'inline-flex');
            c.set(el, 'align-items', 'center');
            const first = el.firstElementChild?.matches('svg,img');
            const side = first ? 'padding-left' : 'padding-right';
            c.set(el, side, Math.max(0, px(st.getPropertyValue(side)) - 2) + 'px'); n++;
          }
        }
        c.css(() => '[data-yba-num-before]::before,[data-yba-num-after]::after{font-variant-numeric:lining-nums tabular-nums!important;line-height:1!important;font-family:ui-sans-serif,system-ui,sans-serif!important;font-weight:700!important}');
        c.note(n ? `Nudged ${n} thing${n > 1 ? 's' : ''} so ${n > 1 ? 'they look' : 'it looks'} lined up.` : 'Already looks lined up.');
      },
    },
    {
      id: 'tabular', label: 'Line up numbers', hint: 'Numbers that jiggle or don’t line up',
      agent: 'Apply `font-variant-numeric: tabular-nums` to numbers that are compared or change over time: stats, prices, tables, counters, timers.',
      auto: true,
      apply(root, c) {
        let n = 0;
        // Judge a number by the sentence it sits in: word-by-word animation splits prose into one-word spans.
        const blockText = (el) => (el.closest('p,li,td,th,dd,dt,h1,h2,h3,h4,h5,h6,figcaption,blockquote') || el).textContent.trim();
        const compared = (el) => { const b = blockText(el); return b.length <= 24 || (b.replace(/\D/g, '').length / b.length) > 0.3 || !!el.closest('table,[class*=stat],[class*=price],[class*=count],[class*=metric]'); }; // short <dd> values still match via length
        for (const el of all(root)) if (/\d/.test(ownText(el)) && compared(el) && !/tabular/.test(cs(el).fontVariantNumeric) && !el.closest('code,pre,kbd')) { c.set(el, 'font-variant-numeric', 'tabular-nums'); n++; }
        c.note(n ? `Lined up the digits in ${n} number${n > 1 ? 's' : ''}.` : 'Numbers already line up (or there are none).');
      },
    },
    {
      id: 'stripes', label: 'Remove side stripes', hint: 'Coloured bars on the edge of cards',
      agent: 'Remove side-stripe borders: a border-left or border-right thicker than 1px used as a coloured accent on cards, list items, callouts, or alerts. Rewrite with a full 1px border, a background tint, a leading icon or number, or nothing.',
      auto: true,
      apply(root, c) {
        let n = 0;
        for (const el of all(root)) {
          const st = cs(el);
          for (const side of ['Left', 'Right']) {
            const w = px(st[`border${side}Width`]);
            if (w <= 1 || st[`border${side}Style`] === 'none') continue;
            const other = px(st[side === 'Left' ? 'borderRightWidth' : 'borderLeftWidth']);
            const top = px(st.borderTopWidth);
            if (w <= Math.max(other, top) + 0.5) continue; // uniform border, not a stripe
            const prop = `border-${side.toLowerCase()}`;
            if (top) c.set(el, `${prop}-width`, top + 'px'); else c.set(el, `${prop}-style`, 'none');
            n++; if (n <= 4) c.note(`Removed the coloured stripe on the ${side.toLowerCase()} of “${short(el.textContent, 24)}”`);
          }
        }
        if (!n) c.note('No side stripes found.');
        else if (n > 4) c.note(`…and ${n - 4} more.`);
      },
    },
    {
      id: 'heavyborder', label: 'Thin out heavy borders', hint: 'Thick outlines drawn around boxes and buttons',
      agent: 'Replace heavy borders (3px or more on every side of a card, panel, button, or image) with a 1px hairline in a tinted neutral, or drop the border and separate with spacing or a background tint. Chunky outlines are a template default, not structure.',
      auto: true,
      apply(root, c) {
        let n = 0;
        for (const el of all(root)) {
          if (/^(INPUT|TEXTAREA|SELECT|HR)$/.test(el.tagName)) continue;
          const st = cs(el);
          const sides = ['Top', 'Right', 'Bottom', 'Left'];
          if (sides.some((s) => st[`border${s}Style`] === 'none' || px(st[`border${s}Width`]) < 3)) continue;
          c.set(el, 'border-width', '1px');
          n++; if (n <= 4) c.note(`Thinned the heavy border around “${short(el.textContent, 24)}”`);
        }
        if (!n) c.note('No heavy borders found.');
        else if (n > 4) c.note(`…and ${n - 4} more.`);
      },
    },
    {
      id: 'gradtext', label: 'Remove rainbow text', hint: 'Text filled with a colour gradient',
      agent: 'Replace gradient text (background-clip: text over a gradient) with a single solid colour. Create emphasis with weight or size, not colour effects.',
      auto: true,
      apply(root, c) {
        let n = 0;
        for (const el of all(root)) {
          const st = cs(el);
          if (!/gradient/.test(st.backgroundImage) || !(st.webkitBackgroundClip === 'text' || st.backgroundClip === 'text')) continue;
          let solid = el.parentElement ? cs(el.parentElement).color : 'rgb(20, 20, 24)';
          if (rgba(solid).a < 0.5) solid = 'rgb(20, 20, 24)';
          c.set(el, 'background-image', 'none'); c.set(el, '-webkit-text-fill-color', 'currentColor'); c.set(el, 'color', solid);
          if (st.textShadow !== 'none') c.set(el, 'text-shadow', 'none');
          n++; c.note(`Made “${short(el.textContent, 30)}” one solid colour`);
        }
        if (!n) c.note('No rainbow text found.');
      },
    },
    {
      id: 'neutrals', label: 'Soften pure black and white', hint: 'Harsh pure black or white',
      agent: 'Never use pure #000 or #fff. Tint every neutral slightly toward the brand hue in OKLCH (chroma 0.005–0.01), and reduce chroma as lightness approaches 0 or 100.',
      auto: true,
      apply(root, c) {
        const H = Math.round(oklch(rgba(accent())).H);
        const light = `oklch(98.5% 0.006 ${H})`, dark = `oklch(18% 0.008 ${H})`;
        let n = 0;
        for (const el of all(root)) {
          const st = cs(el);
          for (const [prop, key] of [['color', 'color'], ['background-color', 'backgroundColor'], ['border-color', 'borderTopColor']]) {
            const v = rgba(st[key]); if (v.a < 0.99) continue;
            if (prop === 'border-color' && !(px(st.borderTopWidth) > 0 && st.borderTopStyle !== 'none')) continue;
            if (v.r >= 252 && v.g >= 252 && v.b >= 252) { c.set(el, prop, light); n++; }
            else if (v.r <= 3 && v.g <= 3 && v.b <= 3) { c.set(el, prop, dark); n++; }
          }
        }
        c.note(n ? `Softened ${n} pure black or white colour${n > 1 ? 's' : ''}.` : 'No harsh black or white found.');
      },
    },
    {
      id: 'scale', label: 'Make headings stand out', hint: 'Headings barely bigger than the text below',
      agent: 'Build hierarchy through scale and weight contrast: at least a 1.25× ratio between adjacent type steps. Avoid flat scales where headings are barely bigger than body text.',
      auto: true,
      apply(root, c) {
        const texts = all(root).filter((el) => ownText(el) && visible(el));
        if (!texts.length) return c.note('No text here.');
        const weight = new Map();
        for (const el of texts) { const f = Math.round(px(cs(el).fontSize)); weight.set(f, (weight.get(f) || 0) + ownText(el).length); }
        const body = [...weight].sort((a, b) => b[1] - a[1])[0][0];
        const steps = [...weight.keys()].filter((f) => f > body).sort((a, b) => a - b);
        let prev = body, changed = 0;
        for (const f of steps) {
          const target = Math.max(f, Math.ceil(prev * 1.25));
          if (target > f) for (const el of texts) if (Math.round(px(cs(el).fontSize)) === f) { c.set(el, 'font-size', target + 'px'); if (px(cs(el).fontWeight) < 600) c.set(el, 'font-weight', '600'); changed++; }
                    prev = target;
        }
        c.note(changed ? `Made ${changed} heading${changed > 1 ? 's' : ''} bigger so ${changed > 1 ? 'they stand' : 'it stands'} out more.` : 'Headings already stand out from the text.');
      },
    },
    {
      id: 'nest', label: 'Remove boxes inside boxes', hint: 'Cards stacked inside other cards',
      agent: 'Remove nested cards: an inner box with its own background, border, shadow, and radius inside another card. Let the inner content sit directly on the parent surface, separated by spacing or type. Cards themselves only where they are truly the best affordance.',
      auto: true,
      apply(root, c) {
        const cardish = (el) => {
          const st = cs(el);
          const surface = rgba(st.backgroundColor).a > 0.05 || (px(st.borderTopWidth) > 0 && st.borderTopStyle !== 'none') || st.boxShadow !== 'none';
          return surface && radiusPx(el, st) > 0 && px(st.paddingTop) >= 8;
        };
        let n = 0;
        for (const el of all(root)) {
          if (el === root || el.closest(INTERACTIVE) || !el.textContent.trim()) continue;
          let host = null; for (let a = el.parentElement; a && root.contains(a); a = a.parentElement) if (cardish(a)) { host = a; break; }
          if (!cardish(el) || !host) continue;
          for (const [p2, v] of [['background', 'transparent'], ['border-color', 'transparent'], ['box-shadow', 'none'], ['padding-left', '0'], ['padding-right', '0'], ['border-radius', '0']]) c.set(el, p2, v);
          n++; c.note(`Removed the box around “${short(el.textContent, 24)}”`);
        }
        if (!n) c.note('No boxes inside boxes.');
      },
    },
    {
      id: 'heroMetric', label: 'Rethink big-number stats', hint: 'A big number with a tiny label, used as decoration',
      agent: 'Avoid the SaaS hero-metric template (big number, small label, supporting stats, gradient accent). Show the metric in context: inside a sentence, next to a real chart or product screenshot, or drop it if it is not a credible, specific claim.',
      auto: 'mark',
      apply(root, c) {
        let n = 0;
        for (const el of all(root)) {
          const t = ownText(el);
          if (!t || !/^[\d$€£¥.,%+×x~<>kKmMbB\s/-]+$/.test(t) || !/\d/.test(t) || px(cs(el).fontSize) < 24) continue;
          const sentence = (el.closest('p,li,h1,h2,h3,h4,h5,h6,figcaption,blockquote') || el).textContent.trim();
          if (sentence.length > 24) continue; // a number inside a sentence (often split into word spans for animation) isn't a stat
          const block = el.parentElement && root.contains(el.parentElement) ? el.parentElement : el;
          c.mark(block, 'Big number used as decoration'); n++;
        }
        c.note(n ? `Marked ${n} big number${n > 1 ? 's' : ''} used as decoration.` : 'No decorative big numbers.');
      },
    },
    {
      id: 'cardGrid', label: 'Vary repeated cards', hint: 'Rows of identical icon-and-text cards',
      agent: 'Break up identical card grids (same-size cards with icon + heading + text repeated). Vary the layout: lead with one larger feature, use a list or table, alternate media and text, or show each feature with real product UI.',
      auto: 'mark',
      apply(root, c) {
        let n = 0;
        const candidates = [root.parentElement, ...all(root)].filter(Boolean);
        for (const g of candidates) {
          const kids = [...g.children].filter((k) => visible(k) && !isOurs(k));
          if (kids.length < 3) continue;
          const rs = kids.map((k) => k.getBoundingClientRect());
          const same = rs.every((r) => Math.abs(r.width - rs[0].width) < 4 && Math.abs(r.height - rs[0].height) < rs[0].height * 0.15);
          const shaped = kids.every((k) => k.querySelector('h1,h2,h3,h4,h5,h6,strong,b') && (k.querySelector('svg,img') || [...k.querySelectorAll('*')].some((e) => !e.children.length && EMOJI.test(e.textContent.trim()))));
          if (same && shaped) { c.mark(g, `${kids.length} identical cards · mix it up`); n++; }
        }
        c.note(n ? `Marked ${n} row${n > 1 ? 's' : ''} of identical cards.` : 'No rows of identical cards.');
      },
    },
    {
      id: 'emdash', label: 'Remove long dashes', hint: 'Long dashes (—) that make text feel AI-written',
      agent: 'Remove em dashes (and "--") from UI copy. Use commas, colons, semicolons, periods, or parentheses instead.',
      auto: true,
      apply(root, c) {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        let n = 0;
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          if (!/—|\s--\s/.test(node.nodeValue) || node.parentElement?.closest('code,pre,script,style')) continue;
          const next = node.nodeValue.replace(/\s*(—|--)\s*/g, ', ');
          c.text(node, next); n++;
          if (n <= 3) c.note(`“${short(c.scan ? node.nodeValue.trim() : next, 40)}”`);
        }
        if (!n) c.note('No long dashes found.');
      },
    },
    {
      id: 'copytells', label: 'Rewrite AI-sounding text', hint: 'Phrases like “It’s not X, it’s Y” or “Unlock the power of”',
      agent: 'Rewrite copy that reads as machine-written, keeping every fact. Remove: contrasts that only add weight ("it\'s not X, it\'s Y", "not just X but Y", a clipped ", no guessing" tail); negation lists ("no setup, no fees, no waiting"); self-answered reveals ("The result?", "The best part:"); one-line closers ("That\'s the real win", "Let that sink in"); sayings that sound deep ("at its core", "what really matters"); staged run-ups ("Let\'s dive in", "Here\'s the thing"); arguing with no one ("To be clear", "Don\'t get me wrong"); inflated significance ("plays a pivotal role", "stands as a testament"); sales words ("nestled", "breathtaking", "stunning"); "serves as" or "boasts" where "is" or "has" works; stock AI words (delve, tapestry, showcase, underscore, seamless, unlock); Title Case headings; emoji in headings; ALL-CAPS words used for emphasis; a bold label on every list item; chatbot leftovers ("I hope this helps"); and exclamation points. Say what the product does, with a number, a name or a concrete step. Never invent stats or testimonials.',
      auto: 'mark',
      apply(root, c) {
        // Phrasing patterns common in AI-written copy, strongest first.
        const TELLS = [
          [/\b(it'?s|this is|that'?s|this isn'?t|it isn'?t)\s+(not\s+)?(just\s+)?[^.?!]{1,48}[,;.]\s*(it'?s|this is|but)\s/i, '“Not X, it’s Y” phrasing'],
          [/\bnot (just|only|merely)\b[^.?!]{1,48}\bbut\b/i, '“Not X, it’s Y” phrasing'],
          [/\bthis does(n'?t| not) mean\b[^.?!]{1,60}[.]\s*it means\b/i, '“Not X, it’s Y” phrasing'],
          [/,\s*no (guessing|fuss|hassle|catch|strings|setup|code)\b/i, '“…, no guessing” ending'],
          [/(^|[.!?]\s+)no\s+[\w-]+[^.?!]{0,32}[,.]\s+no\s+[\w-]+/i, '“No X, no Y” list'],
          [/\bthe (result|catch|best part|secret|kicker|bottom line)\s*[?:]/i, '“The result?” setup'],
          [/\b(that'?s the real win|let that sink in|read that again|that distinction matters|the message was clear|and that changes everything)\b/i, 'Dramatic one-liner'],
          [/\b(the real question is|at its core|what really matters|the heart of the matter|the deeper issue|the (language|currency|architecture) of)\b/i, 'Fake-deep phrase'],
          [/\b(let'?s (dive in|explore|break this down)|here'?s what you need to know|without further ado|here'?s the thing|the thing is|let'?s be honest|real talk)\b|^honestly\?/i, '“Let’s dive in” opener'],
          [/\b(to be clear|don'?t get me wrong|i'?m not saying|this isn'?t (just |mainly )?about|one might be tempted)\b/i, '“To be clear” defence'],
          [/\b(stands as a testament|plays a (key|crucial|pivotal|vital) role|setting the stage for|the future looks bright|exciting times ahead|evolving landscape|indelible mark|a pivotal moment)\b/i, 'Overblown claim'],
          [/\b(nestled|in the heart of|breathtaking|must-visit|stunning|renowned|groundbreaking|diverse array)\b/i, 'Sales-speak'],
          [/\b(serves as|stands as|boasts)\b/i, '“Serves as” instead of “is”'],
          [/\b(say goodbye to|say hello to|unlock the power|unleash|reimagined|redefined|next level|in today'?s (fast-paced|digital)|whether you'?re|the future of|game[- ]?changer|all[- ]in[- ]one|look no further|elevate your|supercharge|delve|tapestry|showcas(e|ing)|underscor(e|es|ing)|meticulous(ly)?|intricate|seamless(ly)?|effortless(ly)?)\b/i, 'Common AI phrase'],
          [/\b(i hope this helps|great question|certainly!|let me know if)\b/i, 'Chatbot leftover'],
          [/!(\s|$)/, 'Exclamation point'],
        ];
        const SMALL = /^(a|an|the|and|or|but|for|nor|of|on|in|to|by|at|as|vs|via|with|from|into)$/i;
        let n = 0;
        const flag = (el, label, t) => { c.mark(el, `${label} · rewrite`); n++; if (n <= 5) c.note(`${label}: “${short(t, 44)}”`); };
        for (const el of all(root)) {
          if (el.closest('code,pre,script,style,blockquote,q') || !visible(el)) continue; // quotations discuss phrases rather than use them
          const block = isHeading(el) || /^(P|LI|FIGCAPTION|DD|DT|TD|BUTTON|A)$/.test(el.tagName) || ownText(el).length > 24;
          if (!block || el.parentElement?.closest('p,li,h1,h2,h3,h4,h5,h6')) continue;
          const t = (el.innerText || '').trim(); if (t.length < 6) continue;
          const hit = TELLS.find(([re]) => re.test(t));
          if (hit) { flag(el, hit[1], t); continue; }
          if (isHeading(el) && /\p{Extended_Pictographic}/u.test(t)) { flag(el, 'Emoji in a heading', t); continue; }
          // Shouting in running text; textContent ignores CSS uppercase, so styled labels don't count.
          if (!isHeading(el) && /\b[A-Z]{4,}[!.]?\s+[A-Z]{4,}\b/.test(el.textContent)) { flag(el, 'ALL-CAPS emphasis', t); continue; }
          // Title Case headings: four or more words, every significant word capitalised.
          if (isHeading(el)) {
            const ws = t.split(/\s+/).filter((w) => /^[A-Za-z]/.test(w) && !SMALL.test(w));
            if (ws.length >= 4 && ws.slice(1).every((w) => /^[A-Z]/.test(w)) && t !== t.toUpperCase()) flag(el, 'Every word capitalised', t);
          }
        }
        // A bold label with a colon on every item of a list.
        for (const list of root.querySelectorAll('ul,ol')) {
          const items = [...list.children].filter((li) => li.tagName === 'LI');
          if (items.length >= 3 && items.every((li) => /^(strong|b)$/i.test(li.firstElementChild?.tagName || '') && /^[^:]{1,40}:/.test(li.innerText.trim()))) flag(list, 'Bold label on every list item', list.innerText);
        }
        if (!n) c.note('No AI-sounding text found.');
        else if (n > 5) c.note(`…and ${n - 5} more.`);
      },
    },
    {
      id: 'weakcta', label: 'Make button text specific', hint: 'Vague buttons like “Get started” or “Learn more”',
      agent: 'Replace generic button and link labels ("Get started", "Learn more", "Submit", "Click here", "Sign up") with an action verb plus what the visitor gets, for example "Start my free trial", "Download the guide", "See pricing for my team".',
      auto: 'mark',
      apply(root, c) {
        const WEAK = /^(submit|sign ?up|learn more|click here|get started|start now|read more|continue|go|send|ok|discover more|explore|find out more|try it|try now)$/i;
        let n = 0;
        for (const el of all(root)) {
          if (!el.matches('a,button,input[type=submit],input[type=button],[role=button]') || !visible(el)) continue;
          const t = (el.innerText || el.value || '').replace(/[→›»>]/g, '').trim();
          if (!WEAK.test(t)) continue;
          c.mark(el, 'Vague button text · say what they get'); n++; c.note(`“${t}” is vague`);
        }
        if (!n) c.note('Button text is specific.');
      },
    },
    {
      id: 'targets', label: 'Make buttons easy to tap', hint: 'Buttons or links too small to hit',
      agent: 'Make every pointer target at least 24×24 CSS px (WCAG 2.2 AA target size), 44px on touch-first layouts, with at least 8px between adjacent targets. Links inside running text are exempt.',
      auto: true,
      apply(root, c) {
        let n = 0;
        for (const el of all(root)) {
          if (!el.matches('a[href],button,input:not([type=hidden]),select,summary,[role=button],[role=link],[role=checkbox],[role=switch],[role=tab]') || !visible(el)) continue;
          if (el.tagName === 'A' && el.closest('p,li,td,dd,blockquote,figcaption') && cs(el).display === 'inline') continue; // inline text links are exempt
          const r = el.getBoundingClientRect(); if (r.width >= 24 && r.height >= 24) continue;
          if (!c.scan) {
            if (cs(el).display === 'inline') c.set(el, 'display', 'inline-flex');
            c.set(el, 'align-items', 'center'); c.set(el, 'justify-content', 'center');
            c.set(el, 'min-width', '24px'); c.set(el, 'min-height', '24px');
          } else c.set(el);
          n++; if (n <= 4) c.note(`“${short((el.innerText || el.getAttribute('aria-label') || el.tagName.toLowerCase()).trim(), 24)}” is too small to tap easily`);
        }
        if (!n) c.note('Buttons and links are big enough to tap.');
        else if (n > 4) c.note(`…and ${n - 4} more.`);
      },
    },
    {
      id: 'alt', label: 'Describe images', hint: 'Images with no description for screen readers',
      agent: 'Give every informative image alt text that says what it shows. Use alt="" on decorative images so screen readers skip them. Never leave the alt attribute off.',
      auto: 'mark',
      apply(root, c) {
        let n = 0;
        for (const el of all(root)) {
          if (el.tagName !== 'IMG' || el.hasAttribute('alt') || el.closest('[aria-hidden=true]') || !visible(el)) continue;
          c.mark(el, 'Image needs a description'); n++;
          if (n <= 3) c.note(`“${short((el.getAttribute('src') || '').split('/').pop(), 28)}” has no description`);
        }
        c.note(n ? `${n} image${n > 1 ? 's have' : ' has'} no description.` : 'Every image has a description.');
      },
    },
    {
      id: 'iconlabels', label: 'Name icon-only buttons', hint: 'Buttons with only an icon and no name',
      agent: 'Give icon-only buttons and links an accessible name with aria-label or visually hidden text, and mark the icon itself aria-hidden="true".',
      auto: 'mark',
      apply(root, c) {
        let n = 0;
        for (const el of all(root)) {
          if (!el.matches('a[href],button,[role=button]') || !visible(el)) continue;
          if ((el.innerText || '').trim() || el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.getAttribute('title')) continue;
          if ([...el.querySelectorAll('img[alt]')].some((i) => i.alt.trim())) continue;
          c.mark(el, 'Button needs a name'); n++;
        }
        c.note(n ? `${n} icon button${n > 1 ? 's have' : ' has'} no name for screen readers.` : 'Every button has a name.');
      },
    },
    {
      id: 'mediaspace', label: 'Stop images shifting the page', hint: 'Images that make the page jump as they load',
      agent: 'Reserve space for images, video and embeds with width and height attributes or a CSS aspect-ratio, so the layout does not jump as they load (keep CLS under 0.1).',
      auto: 'mark',
      apply(root, c) {
        let n = 0;
        for (const el of all(root)) {
          if (!/^(IMG|VIDEO|IFRAME)$/.test(el.tagName) || !visible(el)) continue;
          if ((el.hasAttribute('width') && el.hasAttribute('height')) || cs(el).aspectRatio !== 'auto') continue;
          // Iframes and video default to 300×150; any other rendered size means CSS already reserves the box.
          if (el.tagName !== 'IMG' && Math.round(el.getBoundingClientRect().height) !== 150) continue;
          c.mark(el, 'May make the page jump'); n++;
        }
        c.note(n ? `${n} image${n > 1 ? 's or videos' : ' or video'} may make the page jump while loading.` : 'Images won’t make the page jump.');
      },
    },
    {
      id: 'mobilefit', label: 'Shrink big pictures on phones', hint: 'Pictures that fill most of a phone screen',
      agent: 'On phones, keep decorative art and media to roughly 40% of the first screen so the headline and the next section are reachable in one or two swipes. Use an art-directed mobile crop (<picture>/srcset), background-size relative to the container height, or cap media with max-height in vh. Test at 375px wide before shipping.',
      auto: 'mark',
      apply(root, c) {
        const vw = innerWidth, vh = innerHeight - (barOpen ? BAR_H : 0), phone = vw <= 768; // visible area below the bar
        if (!phone) c.note('Checked at desktop width. Make the window phone-sized and scan again to check phones.');
        let n = 0;
        for (const el of all(root)) {
          if (!visible(el)) continue;
          const r = el.getBoundingClientRect(), st = cs(el);
          const media = /^(IMG|VIDEO|IFRAME|CANVAS|PICTURE)$/.test(el.tagName) || (el.tagName === 'svg' && !el.parentElement?.closest('svg'));
          if (phone && media && r.height > vh * 0.6) { c.mark(el, `Takes up ${Math.round((r.height / vh) * 100)}% of the screen`); n++; c.note(`A picture takes up ${Math.round((r.height / vh) * 100)}% of the screen`); continue; }
          // Sections far taller than the screen whose extra height is padding around background art.
          if (phone && /url\(/.test(st.backgroundImage) && r.height > vh * 1.3) {
            const textH = [...el.querySelectorAll('h1,h2,h3,p,li,a,button')].reduce((m, k) => Math.max(m, k.getBoundingClientRect().bottom), r.top) - r.top;
            if (r.height - textH > vh * 0.45) { c.mark(el, 'Picture takes a lot of room'); n++; c.note(`“${short(el.textContent, 26)}” has a picture that fills most of the screen`); }
          }
        }
        if (phone && !n) c.note('Pictures fit the screen.');
      },
    },
    {
      id: 'hscroll', label: 'Stop sideways scrolling', hint: 'Things wider than the screen',
      agent: 'Remove horizontal scrolling on small screens. Find elements wider than the viewport (fixed px widths, long unbroken strings, wide tables or code) and make them fluid with max-width: 100%, min-width: 0 on flex/grid children, overflow-wrap: anywhere, or a scroll container for genuinely wide content.',
      auto: true,
      apply(root, c) {
        const vw = document.documentElement.clientWidth;
        let n = 0;
        for (const el of all(root)) {
          if (!visible(el) || el.closest('pre,code,table,[style*="overflow"]')) continue;
          const r = el.getBoundingClientRect();
          if (r.right <= vw + 1 || r.width <= 0) continue;
          let clipped = false;
          for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) { if (/hidden|clip|auto|scroll/.test(cs(a).overflowX)) { clipped = true; break; } }
          if (clipped || [...el.children].some((k) => k.getBoundingClientRect().right > vw + 1)) continue; // report the innermost culprit
          if (!c.scan) { c.set(el, 'max-width', '100%'); c.set(el, 'overflow-wrap', 'anywhere'); } else c.set(el);
          n++; if (n <= 4) c.note(`“${short(el.textContent, 22)}” is wider than the screen`);
        }
        if (!n) c.note('Nothing is wider than the screen.');
      },
    },
    {
      id: 'smalltext', label: 'Make small text bigger', hint: 'Text too small to read comfortably',
      agent: 'Keep body text at 16px or more on phones (so iOS does not zoom form fields) and never set readable text below 12px. Use the type scale rather than shrinking text to make it fit.',
      auto: true,
      apply(root, c) {
        const phone = innerWidth <= 768; let n = 0;
        for (const el of all(root)) {
          const t = ownText(el); if (!t || !visible(el) || el.closest('sup,sub,code,kbd,pre')) continue; // code blocks conventionally run smaller
          const fs = px(cs(el).fontSize);
          const body = phone && (el.tagName === 'P' || el.matches('input,textarea,select') || (words(t) > 12 && !isHeadline(el)));
          const min = body ? 16 : 12;
          if (fs >= min) continue;
          if (!c.scan) c.set(el, 'font-size', min + 'px'); else c.set(el);
          n++; if (n <= 4) c.note(`“${short(t, 24)}” is too small to read comfortably`);
        }
        if (!n) c.note(phone ? 'Text is big enough to read.' : 'No tiny text found.');
      },
    },
    {
      id: 'loading', label: 'Show loading progress', hint: 'Areas that sit blank while content loads',
      agent: 'Add loading states: skeletons shaped like the final layout for async content (images, lists, stats, tables), and a pending/disabled state with spinner on submit buttons. Avoid layout shift when data arrives.',
      auto: 'mark',
      apply(root, c) {
        let n = 0;
        for (const el of all(root)) {
          if (!el.matches('iframe,video,canvas,table,form,button[type=submit],input[type=submit],[data-src]') || !visible(el)) continue;
          if (el.closest('[aria-busy],[data-loading],[class*=skeleton]')) continue; // already declares a loading state
          c.mark(el, 'Needs a loading indicator'); n++;
        }
        c.note(n ? `Marked ${n} area${n > 1 ? 's' : ''} that may need a loading indicator.` : 'No obvious loading areas. Check anything that loads data.');
      },
    },
    {
      id: 'motion', label: 'Use helpful animation', hint: 'Looping animation instead of feedback on clicks',
      agent: 'Remove decorative looping animations (floating, pulsing, shimmering for no reason). Add short (100–200ms) transitions that give feedback: hover colour, press scale (~0.97), visible focus rings, and state changes. Never animate layout properties (width, height, top/left, margin, padding); use transform and opacity. Ease out with exponential curves (ease-out-quart/quint/expo), no bounce or elastic. Respect prefers-reduced-motion.',
      auto: true,
      apply(root, c) {
        let n = 0, lay = 0, bounce = 0;
        for (const el of all(root)) {
          const st = cs(el);
          // Only loops are decoration; a one-shot entrance on a state change (opening an accordion) is feedback.
          const loops = st.animationIterationCount.split(',').some((v) => v.trim() === 'infinite' || parseFloat(v) > 1);
          if (st.animationName !== 'none' && loops && !el.matches('[role=progressbar],[aria-busy=true],.spinner,[class*=spin],[class*=load]')) { c.set(el, 'animation', 'none'); n++; }
          if (st.transitionDuration.split(',').some((d) => px(d) > 0)) {
            if (/\b(all|width|height|top|left|right|bottom|margin|padding|inset)/.test(st.transitionProperty)) { c.set(el, 'transition-property', 'opacity, transform, color, background-color, border-color, box-shadow'); lay++; }
            const bez = [...st.transitionTimingFunction.matchAll(/cubic-bezier\(([^)]+)\)/g)].some((m) => m[1].split(',').map(Number).some((v, i) => i % 2 === 1 && (v > 1 || v < 0)));
            if (bez) { c.set(el, 'transition-timing-function', 'cubic-bezier(.16, 1, .3, 1)'); bounce++; }
          }
        }
        const a = accent();
        c.css((S) => `${S} :is(a,button,[role=button],input,select,textarea),${S}:is(a,button){transition:background-color .15s,color .15s,border-color .15s,transform .12s cubic-bezier(.16,1,.3,1),box-shadow .15s!important}
${S} :is(button,[role=button],a):active,${S}:is(button,a):active{transform:scale(.97)!important}
${S} :is(a,button,[role=button],input,select,textarea):focus-visible{outline:2px solid ${a}!important;outline-offset:2px!important}
@media (prefers-reduced-motion: reduce){${S} *{transition:none!important}}`);
        c.note(`${n ? `Stopped ${n} looping animation${n > 1 ? 's' : ''} and added` : 'Added'} feedback when you hover or click.`);
        if (lay) c.note(`Made ${lay} animation${lay > 1 ? 's' : ''} smoother.`);
        if (bounce) c.note(`Replaced ${bounce} bouncy animation${bounce > 1 ? 's' : ''} with a smooth one.`);
      },
    },
    {
      id: 'heroimg', label: 'Load the main image first', hint: 'The biggest picture on the first screen loads late',
      agent: 'The largest image on the first screen is usually the LCP element. Put it in the HTML as an <img> (not a CSS background), remove loading="lazy" from it, and add fetchpriority="high". Keep lazy loading for images further down.',
      auto: 'mark',
      apply(root, c) {
        let best = null, area = 0;
        for (const el of all(root)) {
          if (el.tagName !== 'IMG' || !visible(el)) continue;
          const r = el.getBoundingClientRect();
          if (r.top + scrollY >= innerHeight || r.width < 280) continue; // first screen only
          if (r.width * r.height > area) { area = r.width * r.height; best = el; }
        }
        if (!best) { c.note('No large image on the first screen.'); return; }
        const lazy = best.loading === 'lazy', prio = (best.getAttribute('fetchpriority') || '').toLowerCase() === 'high';
        if (!lazy && prio) { c.note('The main image already loads first.'); return; }
        c.mark(best, lazy ? 'Main image loads lazily' : 'Main image needs high priority');
        c.note(`“${short((best.getAttribute('alt') || best.currentSrc || best.src || '').split('/').pop(), 28)}” ${lazy ? 'waits to load even though it’s on the first screen' : 'loads at normal priority'}`);
      },
    },
    {
      id: 'deadlinks', label: 'Fix links that go nowhere', hint: 'Links like href="#" that do nothing',
      agent: 'Give every link a real destination: a page that exists, an id that exists on this page, or a mailto:/tel: address. Replace href="#", empty hrefs and javascript: links; if the element runs a script, make it a <button>. Remove nav items for pages that are not built yet, or label them "Coming soon".',
      auto: 'mark',
      apply(root, c) {
        let n = 0;
        for (const el of all(root)) {
          if (el.tagName !== 'A' || !el.hasAttribute('href') || !visible(el)) continue;
          const h = el.getAttribute('href').trim();
          let why = null;
          if (h === '' || h === '#') why = 'Link goes nowhere';
          else if (/^javascript:/i.test(h)) why = 'Link runs a script · use a button';
          else if (h.startsWith('#')) {
            let id = h.slice(1); try { id = decodeURIComponent(id); } catch { /* keep raw */ }
            // Hash routes (#/page, #!page) and #top are handled by the app or the browser.
            if (!/^[/!]/.test(id) && id.toLowerCase() !== 'top' && !document.getElementById(id) && !document.getElementsByName(id).length) why = `Nothing called “${short(h, 20)}” on this page`;
          }
          if (!why) continue;
          c.mark(el, why); n++;
          if (n <= 4) c.note(`“${short((el.innerText || el.getAttribute('aria-label') || 'link').trim(), 24)}”: ${why.toLowerCase()}`);
        }
        if (!n) c.note('Every link goes somewhere.');
        else if (n > 4) c.note(`…and ${n - 4} more.`);
      },
    },
    {
      id: 'fakebuttons', label: 'Use real buttons', hint: 'Clickable boxes that a keyboard can’t reach',
      agent: 'Replace clickable <div>/<span> elements with native controls: <button> for actions, <a href> for navigation. If a custom element has to stay, give it a role, tabindex="0", a visible focus style, and Enter/Space key handlers.',
      auto: 'mark',
      apply(root, c) {
        let n = 0;
        for (const el of all(root)) {
          if (el.matches(`${INTERACTIVE},label,[role],[tabindex],svg *`) || el.closest('a,button,label,summary,select,[role=button],[role=link]') || !visible(el)) continue;
          const st = cs(el);
          const scripted = el.hasAttribute('onclick');
          // cursor inherits, so only count the element where the pointer is set, not its children.
          const pointer = st.cursor === 'pointer' && (!el.parentElement || cs(el.parentElement).cursor !== 'pointer');
          if (!scripted && !pointer) continue;
          if (el.querySelector('a[href],button,input,select,textarea,summary,[role=button]')) continue; // a card wrapping a real link
          c.mark(el, 'Clickable but not a real button'); n++;
          if (n <= 4) c.note(`“${short(el.innerText || `<${el.tagName.toLowerCase()}>`, 24)}” acts like a button but isn’t one`);
        }
        if (!n) c.note('Clickable things are real buttons or links.');
        else if (n > 4) c.note(`…and ${n - 4} more.`);
      },
    },
    {
      id: 'pointer', label: 'Show a hand cursor on controls', hint: 'Buttons that keep the arrow cursor',
      agent: 'In the base CSS layer, give every enabled control cursor: pointer: a[href], button, summary, select, label[for], checkboxes, radios and custom role="button"/"tab"/"switch" elements. Give disabled controls cursor: not-allowed.',
      auto: true,
      apply(root, c) {
        let n = 0;
        for (const el of all(root)) {
          if (!el.matches('a[href],button,summary,select,label[for],input[type=checkbox],input[type=radio],input[type=submit],input[type=button],input[type=reset],[role=button],[role=tab],[role=switch]') || !visible(el)) continue;
          if (el.disabled || el.getAttribute('aria-disabled') === 'true') continue;
          if (!/^(auto|default)$/.test(cs(el).cursor)) continue;
          c.set(el, 'cursor', 'pointer'); n++;
        }
        c.note(n ? `Added a hand cursor to ${n} control${n > 1 ? 's' : ''}.` : 'Controls already show a hand cursor.');
      },
    },
    {
      id: 'fieldlabels', label: 'Label every form field', hint: 'Fields with only placeholder text, or nothing',
      agent: 'Give every input, select and textarea a visible <label> tied to it with for/id (or wrapping it). Placeholder text disappears as soon as someone types, so it can hint at the format but never replace the label. Use aria-label only when the purpose is visually obvious, such as a search field next to a search button.',
      auto: 'mark',
      apply(root, c) {
        let n = 0;
        for (const el of all(root)) {
          if (!el.matches('input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=reset]):not([type=image]),select,textarea') || !visible(el)) continue;
          if (el.labels?.length || el.getAttribute('aria-label')?.trim() || el.getAttribute('aria-labelledby') || el.getAttribute('title')?.trim()) continue;
          const ph = el.getAttribute('placeholder')?.trim();
          c.mark(el, ph ? 'Placeholder isn’t a label' : 'Field has no label'); n++;
          if (n <= 4) c.note(ph ? `“${short(ph, 24)}” is only placeholder text` : `A ${el.tagName === 'INPUT' ? (el.type || 'text') : el.tagName.toLowerCase()} field has no label`);
        }
        if (!n) c.note('Every field has a label.');
        else if (n > 4) c.note(`…and ${n - 4} more.`);
      },
    },
    {
      id: 'headingorder', label: 'Keep heading levels in order', hint: 'Headings that skip levels, like h2 straight to h4',
      agent: 'Use one h1 per page and step heading levels down one at a time (h1 → h2 → h3). Pick the level for the outline, then style it with CSS; never choose h4 because it looks the right size.',
      auto: 'mark',
      apply(root, c) {
        const hs = all(root).filter((el) => /^H[1-6]$/.test(el.tagName) && visible(el) && el.textContent.trim());
        const page = root === document.body;
        let prev = null, h1s = 0, n = 0;
        for (const h of hs) {
          const lv = +h.tagName[1];
          if (lv === 1 && ++h1s > 1 && page) { c.mark(h, 'A second h1'); n++; if (n <= 4) c.note(`“${short(h.textContent, 26)}” is a second h1`); }
          const from = prev ?? (page ? 0 : null);
          if (from !== null && lv > from + 1) { c.mark(h, `Jumps from ${from ? 'h' + from : 'the top'} to h${lv}`); n++; if (n <= 4) c.note(`“${short(h.textContent, 26)}” skips from ${from ? 'h' + from : 'the start'} to h${lv}`); }
          prev = lv;
        }
        if (!hs.length) c.note('No headings here.');
        else if (!n) c.note('Heading levels are in order.');
        else if (n > 4) c.note(`…and ${n - 4} more.`);
      },
    },
    {
      id: 'faq', label: 'Answer real questions in the FAQ', hint: 'Template questions like “Can I cancel anytime?”',
      agent: 'Rewrite FAQ entries so each one answers something real users of this product ask (from support tickets, sales calls or reviews). Remove template questions that fit any SaaS page ("Is my data secure?", "Can I cancel anytime?", "Do you offer a free trial?") unless the answer says something specific to this product. No FAQ is better than a generic one.',
      auto: 'mark',
      apply(root, c) {
        const GENERIC = /^(is my data (safe|secure)|how secure is (my data|it)|can i cancel( (at )?any ?time)?|do you offer (a )?(free trial|refunds?|discounts?|support)|is there a free (trial|plan|version)|do i need a credit card|what payment methods do you accept|what is your refund policy|can i (upgrade|downgrade|change) (my )?plan|how do i get started|what makes [\w\s]{1,30} different|who is [\w\s]{1,30} for|is [\w\s]{1,30} right for me|how does [\w\s]{1,30} work)\??$/i;
        let n = 0;
        for (const el of all(root)) {
          if (!el.matches('summary,dt,h2,h3,h4,h5,h6,button[aria-expanded]') || !visible(el)) continue;
          const t = (el.innerText || '').replace(/\s+/g, ' ').trim();
          if (!GENERIC.test(t)) continue;
          c.mark(el, 'Template FAQ question'); n++;
          if (n <= 4) c.note(`“${short(t, 40)}” could be on any site`);
        }
        if (!n) c.note('No template FAQ questions found.');
      },
    },
    {
      id: 'logobar', label: 'Back up the logo bar', hint: '“Trusted by” rows of company logos',
      agent: 'Remove "Trusted by" / "Used by teams at" logo rows unless every company shown really uses the product and agreed to be named. One real quote with a name and role, or a link to a public case study, says more than a strip of logos.',
      auto: 'mark',
      apply(root, c) {
        const LEAD = /^(trusted|used|loved|chosen|backed|relied on|powering|built) (by|at|for)\b|^(join|over|more than) [\d,.]+k?\+? (teams|companies|businesses|developers|customers)/i;
        let n = 0; const done = new Set();
        for (const el of all(root)) {
          const t = (ownText(el) || (el.children.length ? '' : el.textContent)).trim();
          if (!t || t.length > 80 || !LEAD.test(t) || !visible(el)) continue;
          // The logos are the next sibling, or siblings, of the lead-in, possibly one level up.
          for (let box = el.parentElement, depth = 0; box && box !== document.body && depth < 3; box = box.parentElement, depth++) {
            const logos = [...box.querySelectorAll('img,svg')].filter((m) => !m.parentElement.closest('svg') && visible(m) && m.getBoundingClientRect().height <= 80);
            if (logos.length < 3) continue;
            if (!done.has(box)) { done.add(box); c.mark(box, 'Logo bar · use real proof'); n++; c.note(`“${short(t, 30)}” above ${logos.length} logos`); }
            break;
          }
        }
        if (!n) c.note('No “Trusted by” logo bars found.');
      },
    },
    {
      id: 'arrows', label: 'Drop arrows from buttons', hint: 'An arrow on almost every button',
      agent: 'Remove arrow glyphs and arrow icons (→, ↗, chevrons) from buttons where they are decoration. Keep one where it means something: ↗ on a link that leaves the site, or a single primary action that moves the visitor forward.',
      auto: true,
      apply(root, c) {
        const ARROW = /[→↗➔➜⟶↘⇢]/;
        const iconArrow = (el) => [...el.querySelectorAll('svg')].find((s) => /arrow|chevron/i.test((s.getAttribute('class') || '') + ' ' + (s.getAttribute('data-icon') || '') + ' ' + (s.parentElement?.getAttribute('class') || '')));
        const buttons = all(root).filter(isActionButton);
        const hits = buttons.filter((b) => ARROW.test(b.textContent) || iconArrow(b));
        // One arrow can be a deliberate signal; it is a habit when most buttons carry one.
        if (hits.length < 3 || hits.length < buttons.length / 2) { c.note(hits.length ? 'Arrows are used sparingly.' : 'No arrows on buttons.'); return; }
        for (const b of hits) {
          const walker = document.createTreeWalker(b, NodeFilter.SHOW_TEXT);
          for (let node = walker.nextNode(); node; node = walker.nextNode()) if (ARROW.test(node.nodeValue)) c.text(node, node.nodeValue.replace(/\s*[→↗➔➜⟶↘⇢]+/g, ''));
          const svg = iconArrow(b); if (svg) c.hide(svg);
        }
        c.note(`Removed arrows from ${hits.length} of ${buttons.length} buttons.`);
      },
    },
    {
      id: 'statusdot', label: 'Remove decorative status dots', hint: 'Small glowing dots inside tags and labels',
      agent: 'Remove small coloured dots placed inside badges, pills and labels as decoration (often pulsing). Keep a dot only when it reports a real, changing state, such as online/offline or a build status, and give that state a text label too.',
      auto: true,
      apply(root, c) {
        let n = 0;
        for (const el of all(root)) {
          if (el.children.length || el.textContent.trim() || !visible(el)) continue;
          const r = el.getBoundingClientRect(), st = cs(el);
          if (r.width < 4 || r.width > 14 || Math.abs(r.width - r.height) > 1 || radiusPx(el, st) < r.width / 2 - 1) continue;
          if (rgba(st.backgroundColor).a < 0.5 && !/gradient/.test(st.backgroundImage)) continue;
          const host = el.parentElement; if (!host || host.closest('[role=status],[aria-live]')) continue;
          const hr = host.getBoundingClientRect(), ht = host.textContent.trim();
          const inPill = hr.height <= 40 && ht.length > 0 && ht.length <= 40;
          const pulsing = st.animationName !== 'none' || cs(el, '::after').animationName !== 'none' || cs(el, '::before').animationName !== 'none';
          if (!inPill && !pulsing) continue;
          c.hide(el); n++;
          if (n <= 3) c.note(`Removed the dot next to “${short(ht || 'label', 24)}”`);
        }
        if (!n) c.note('No decorative dots found.');
        else if (n > 3) c.note(`…and ${n - 3} more.`);
      },
    },
    {
      id: 'terminal', label: 'Drop fake terminal windows', hint: 'Window frames with red, yellow and green dots',
      agent: 'Replace decorative terminal or app windows (three traffic-light dots over typed-out commands) with the real thing: a screenshot or short recording of the product, or, for a CLI, a plain code block holding the actual command and its real output.',
      auto: 'mark',
      apply(root, c) {
        const isDot = (el) => {
          const r = el.getBoundingClientRect();
          return !el.textContent.trim() && r.width >= 6 && r.width <= 18 && Math.abs(r.width - r.height) <= 1 && radiusPx(el) >= r.width / 2 - 1;
        };
        const hue = (el) => { const v = rgba(cs(el).backgroundColor); if (v.a < 0.5) return null; const { r, g, b } = v;
          return r > 190 && g < 140 && b < 140 ? 'red' : r > 190 && g > 140 && b < 120 ? 'yellow' : g > 150 && r < 140 && b < 140 ? 'green' : null; };
        let n = 0; const done = new Set();
        for (const row of all(root)) {
          const dots = [...row.children].filter(isDot);
          if (dots.length < 3) continue;
          const hues = new Set(dots.map(hue));
          if (!(hues.has('red') && hues.has('yellow') && hues.has('green'))) continue;
          // The window is the nearest ancestor that holds content beyond the dot row.
          let win = row.parentElement;
          for (let i = 0; win && win !== document.body && i < 3 && (win.innerText || '').trim().length < 8; i++) win = win.parentElement;
          if (!win || win === document.body || done.has(win)) continue;
          done.add(win); c.mark(win, 'Fake window · show the real product'); n++;
          c.note(`A fake window frame around “${short(win.innerText || 'content', 30)}”`);
        }
        if (!n) c.note('No fake terminal windows found.');
      },
    },
    {
      id: 'bggrid', label: 'Remove background grids', hint: 'Graph-paper lines or dot patterns behind content',
      agent: 'Remove decorative background grids, graph-paper lines and dot patterns (small repeating gradients behind sections). Keep a texture only when it is part of the brand and say why in a code comment; otherwise let colour and spacing carry the section.',
      auto: true,
      apply(root, c) {
        let n = 0;
        for (const el of all(root)) {
          const st = cs(el);
          if (!/gradient/.test(st.backgroundImage) || /url\(/.test(st.backgroundImage) || isLegibilityOverlay(el)) continue;
          const r = el.getBoundingClientRect(); if (r.width < 200 || r.height < 120) continue;
          const tiles = (st.backgroundSize.match(/[\d.]+px/g) || []).map(px);
          const tiled = tiles.length && Math.max(...tiles) <= 96 && !/no-repeat/.test(st.backgroundRepeat);
          const stripes = /repeating-(linear|radial)-gradient/.test(st.backgroundImage);
          if (!tiled && !stripes) continue;
          c.set(el, 'background-image', 'none'); n++;
          if (n <= 3) c.note(`Removed the pattern behind “${short(el.innerText || 'a section', 24)}”`);
        }
        if (!n) c.note('No background grids found.');
        else if (n > 3) c.note(`…and ${n - 3} more.`);
      },
    },
  ];
  const RULE = Object.fromEntries(RULES.map((r) => [r.id, r]));

  // ───────────────────────── full-page scan ─────────────────────────
  // Runs detection-worthy rules in dry-run mode over <body>: nothing changes, every target element is recorded.
  const SCAN_RULES = ['fonts', 'gradtext', 'badges', 'labels', 'headlines', 'copytells', 'weakcta', 'emdash', 'targets', 'alt', 'iconlabels', 'mediaspace', 'italics', 'mono', 'scale', 'accent', 'neutrals', 'contrast',
    'stripes', 'heavyborder', 'nest', 'toprow', 'mobilefit', 'hscroll', 'smalltext', 'heroMetric', 'cardGrid', 'embellish', 'icons', 'radius', 'motion',
    'faq', 'logobar', 'deadlinks', 'fakebuttons', 'pointer', 'fieldlabels', 'headingorder', 'bggrid', 'arrows', 'statusdot', 'terminal', 'heroimg'];
  let scanResult = null, scanning = false;

  async function runScan(onProgress) {
    refreshCovered();
    scanning = true;
    const findings = [];
    for (let i = 0; i < SCAN_RULES.length; i++) {
      const rule = RULE[SCAN_RULES[i]];
      onProgress?.(i, SCAN_RULES.length);
      await new Promise((r) => setTimeout(r, 0)); // keep the page responsive
      const els = new Set(), notes = [];
      const add = (el) => { if (el && el.nodeType === 1 && !isOurs(el)) els.add(el); };
      const ctx = { scan: true, rule: rule.id, has: () => false, set: add, hide: add, attr: add, mark: add, css() {}, text: (n) => add(n.parentElement), note: (t) => notes.push(t) };
      try { rule.apply(document.body, ctx); } catch (e) { notes.push('Scan failed: ' + e.message); }
      if (els.size) findings.push({ id: rule.id, els: [...els], notes });
    }
    findings.sort((a, b) => b.els.length - a.els.length);
    scanResult = { findings, profile: styleProfile(), at: Date.now() };
    scanning = false;
    return scanResult;
  }

  function styleProfile() {
    const fonts = new Map(), text = new Set(), bgs = new Set(), radii = new Set();
    let gradients = 0, shadows = 0, total = 0;
    for (const el of all(document.body)) {
      const st = cs(el);
      const t = ownText(el);
      if (t && visible(el)) { const f = primaryFont(el); fonts.set(f, (fonts.get(f) || 0) + t.length); total += t.length; text.add(st.color); }
      if (rgba(st.backgroundColor).a > 0.5) bgs.add(st.backgroundColor);
      if (/gradient/.test(st.backgroundImage)) gradients++;
      if (st.boxShadow !== 'none') shadows++;
      const r = radiusPx(el, st); if (r > 0 && r < 999) radii.add(Math.round(r));
    }
    return {
      fonts: [...fonts].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([f, n]) => ({ name: titleCase(f), tier: SLOP_FONTS[f] || null, share: total ? Math.round((n / total) * 100) : 0 })),
      colours: text.size + bgs.size, gradients, shadows, radii: [...radii].sort((a, b) => a - b),
    };
  }

  // Rule notes describe a preview ("Removed…"); the scan changes nothing, so phrase them as findings.
  const SCAN_PHRASES = [
    [/^Removed the “(.+)” tag$/, 'Filler tag “$1”'],
    [/^Removed “(.+)” above the heading$/, '“$1” repeats the heading'],
    [/^Removed the number “(.+)” next to “(.+)”$/, 'Number “$1” next to “$2”'],
    [/^Removed “(.+)”, which only describes the picture$/, '“$1” only describes the picture'],
    [/^Made upright: /, 'Slanted for no reason: '],
    [/^Changed (\d+) bits? of code-style text to the normal font\./, '$1 bits of code-style text used for looks'],
    [/^Evened out (\d+) text sizes?, (\d+) gaps? and (\d+) rounded corners?\./, 'Uneven sizing: $1 text sizes, $2 gaps, $3 corners'],
    [/^Removed (\d+) glows?, shadows? or blurs?\./, '$1 glows, shadows or blurs'],
    [/^Removed the coloured stripe on the (left|right) of /, 'Coloured stripe on the $1 of '],
    [/^Thinned the heavy border around /, 'Heavy border around '],
    [/^Softened (\d+) pure black or white colours?\./, '$1 harsh pure black or white colours'],
    [/^Removed the box around /, 'Box inside a box: '],
    [/^Made “(.+)” one solid colour$/, 'Rainbow text: “$1”'],
    [/^Replaced (\d+) rainbow text and (\d+) rainbow backgrounds? with one colour\./, '$2 rainbow backgrounds and $1 rainbow text'],
    [/^Stopped (\d+) looping animations? and added feedback when you hover or click\./, '$1 looping animations'],
    [/^Matched (\d+) rounded corners? to the box(es)? around (them|it)\./, '$1 rounded corners don’t fit their boxes'],
    [/^“(.+)” was hard to read\. Made it (darker|lighter)\.$/, '“$1” is hard to read'],
    [/^Made (\d+) headings? bigger so (they stand|it stands) out more\./, '$1 headings barely bigger than the text'],
    [/^Made “(.+)” narrower so the lines are easier to read$/, '“$1” has very long lines'],
    [/^“(.+)” sat lower than its heading\. Lined them up\.$/, '“$1” sits lower than its heading'],
    [/^Lined up the digits in (\d+) numbers?\./, '$1 numbers don’t line up'],
    [/^Removed (\d+) divider lines?/, '$1 divider lines'],
    [/^Added a hand cursor to (\d+) controls?\./, '$1 controls without a hand cursor'],
    [/^Removed arrows from (\d+) of (\d+) buttons\./, 'Arrows on $1 of $2 buttons'],
    [/^Removed the dot next to “(.+)”$/, 'Decorative dot next to “$1”'],
    [/^Removed the pattern behind “(.+)”$/, 'Background pattern behind “$1”'],
  ];
  const scanNote = (t) => SCAN_PHRASES.reduce((acc, [re, to]) => acc.replace(re, to), t);

  // Nearest meaningful component around a flagged element, so the popover opens on something worth fixing.
  function componentFor(el) {
    const c = el.closest('section,article,header,footer,nav,aside,form,li,[class*=card],[class*=hero],[class*=callout],[class*=banner]');
    return c && c !== document.body ? c : el;
  }

  // ───────────────────────── sessions (one per inspected element) ─────────────────────────
  const sessions = new Map(); // el -> session
  let nextId = 1;
  let approved = []; // serialisable report items

  function getSession(el) {
    if (sessions.has(el)) return sessions.get(el);
    const id = 'd' + nextId++;
    const s = { id, el, checked: new Set(), notes: {}, log: null, approved: false, html: snapshotHTML(el), selector: selectorFor(el) };
    el.setAttribute('data-yba-root', id);
    sessions.set(el, s); return s;
  }

  function snapshotHTML(el) {
    const clone = el.cloneNode(true);
    clone.querySelectorAll?.('[data-yba-root]').forEach((n) => n.removeAttribute('data-yba-root'));
    clone.removeAttribute?.('data-yba-root');
    return short(clone.outerHTML.replace(/\s+/g, ' '), 1500);
  }

  function selectorFor(el) {
    if (el.id && document.querySelectorAll('#' + CSS.escape(el.id)).length === 1) return '#' + CSS.escape(el.id);
    const parts = [];
    for (let n = el; n && n.nodeType === 1 && n !== document.documentElement; n = n.parentElement) {
      if (n.id && document.querySelectorAll('#' + CSS.escape(n.id)).length === 1) { parts.unshift('#' + CSS.escape(n.id)); break; }
      let part = n.tagName.toLowerCase();
      const cls = [...n.classList].filter((c) => !/^(css|sc|jsx|svelte|emotion)-|[0-9a-f]{5,}|^_|^data-yba/.test(c) && c.length < 32).slice(0, 2);
      if (cls.length) part += '.' + cls.map((c) => CSS.escape(c)).join('.');
      const sibs = n.parentElement ? [...n.parentElement.children].filter((s) => s.tagName === n.tagName) : [];
      if (sibs.length > 1) part += `:nth-of-type(${sibs.indexOf(n) + 1})`;
      parts.unshift(part);
      const sel = parts.join(' > ');
      try { if (document.querySelectorAll(sel).length === 1) return sel; } catch { /* keep walking */ }
      if (parts.length >= 6) break;
    }
    return parts.join(' > ');
  }

  function revert(s) {
    if (!s.log) return;
    for (const x of s.log.styles.reverse()) x.v ? x.el.style.setProperty(x.prop, x.v, x.p) : x.el.style.removeProperty(x.prop);
    for (const a of s.log.attrs.reverse()) a.had ? a.el.setAttribute(a.name, a.v) : a.el.removeAttribute(a.name);
    for (const st of s.log.sheets) st.remove();
    for (const t of (s.log.texts || []).reverse()) t.node.nodeValue = t.v;
    for (const el of all(s.el)) if (el.getAttribute('style') === '') el.removeAttribute('style');
    s.log = null;
    renderMarks();
  }

  function applyRules(s) {
    refreshCovered();
    revert(s);
    s.log = { styles: [], attrs: [], sheets: [], marks: [], texts: [] }; s.notes = {};
    const sel = `[data-yba-root="${s.id}"]`;
    const ctx = {
      rule: null,
      has: (id) => s.checked.has(id),
      set(el, prop, val) { s.log.styles.push({ el, prop, v: el.style.getPropertyValue(prop), p: el.style.getPropertyPriority(prop) }); el.style.setProperty(prop, val, 'important'); },
      hide(el) { this.set(el, 'display', 'none'); },
      text(node, value) { s.log.texts.push({ node, v: node.nodeValue }); node.nodeValue = value; },
      attr(el, name, val) { s.log.attrs.push({ el, name, had: el.hasAttribute(name), v: el.getAttribute(name) }); el.setAttribute(name, val); },
      css(fn) { const st = document.createElement('style'); st.setAttribute('data-yba', ''); st.textContent = fn(sel); (document.head || document.documentElement).appendChild(st); s.log.sheets.push(st); },
      note(t) { (s.notes[this.rule] ||= []).push(t); },
      mark(el, reason) { this.set(el, 'outline', '2px dashed #e5484d'); this.set(el, 'outline-offset', '3px'); s.log.marks.push({ el, reason }); },
    };
    for (const r of RULES) {
      if (!s.checked.has(r.id)) continue;
      ctx.rule = r.id; s.notes[r.id] = [];
      try { r.apply(s.el, ctx); } catch (e) { ctx.note('Preview failed: ' + e.message); }
    }
    renderMarks();
  }

  // Small red tags explaining each dashed outline (agent-only rules).
  function renderMarks() {
    const box = shadow?.querySelector?.('.marks'); if (!box) return;
    if (!open) { box.innerHTML = ''; return; }
    const out = [];
    for (const s of sessions.values()) for (const m of s.log?.marks || []) {
      const r = m.el.getBoundingClientRect();
      if (!r.width || r.bottom < 84 || r.top > innerHeight) continue; // fully under the bar or off-screen
      const top = r.top - 26 >= 56 ? r.top - 26 : Math.max(56, r.top + 4);
      out.push(`<div class="mk" style="left:${Math.max(4, r.left - 3)}px;top:${top}px">${esc(m.reason || 'Flagged for agent')}</div>`);
    }
    box.innerHTML = out.join('');
  }

  function discard(s) {
    revert(s); s.el.removeAttribute('data-yba-root'); sessions.delete(s.el);
  }

  // ───────────────────────── UI (shadow DOM) ─────────────────────────
  const host = document.createElement(HOST_TAG);
  host.style.cssText = 'all: initial; position: fixed; inset: 0 auto auto 0; z-index: 2147483647; width: 0; height: 0;';
  // Pages with smooth-scroll libraries (Lenis, GSAP ScrollSmoother, Locomotive…) cancel wheel and touch scrolling
  // at the page level, which froze Yba's scrollable panels. Lenis skips elements marked data-lenis-prevent;
  // for other libraries, wheel and touch events stop at Yba's UI so the page never sees them.
  // Native scrolling inside the panels is unaffected.
  host.setAttribute('data-lenis-prevent', '');
  for (const type of ['wheel', 'touchstart', 'touchmove']) host.addEventListener(type, (e) => e.stopPropagation(), { passive: true });
  const shadow = host.attachShadow({ mode: 'open' });
  // One icon set: 16px, 1.75 stroke, round caps.
  const ICON = {
    target: '<circle cx="8" cy="8" r="5.25"/><path d="M8 1v3M8 12v3M1 8h3M12 8h3"/>',
    list: '<path d="M5.5 4h8M5.5 8h8M5.5 12h8M2.5 4h.01M2.5 8h.01M2.5 12h.01"/>',
    copy: '<rect x="5.5" y="5.5" width="8" height="8" rx="1.5"/><path d="M10.5 5.5V3.5A1.5 1.5 0 0 0 9 2H3.5A1.5 1.5 0 0 0 2 3.5V9a1.5 1.5 0 0 0 1.5 1.5h2"/>',
    check: '<path d="M3 8.5l3.25 3L13 4.5"/>',
    x: '<path d="M4 4l8 8M12 4l-8 8"/>',
    up: '<path d="M8 13V3M3.75 7.25L8 3l4.25 4.25"/>',
    scan: '<path d="M2 5V3.5A1.5 1.5 0 0 1 3.5 2H5M11 2h1.5A1.5 1.5 0 0 1 14 3.5V5M14 11v1.5a1.5 1.5 0 0 1-1.5 1.5H11M5 14H3.5A1.5 1.5 0 0 1 2 12.5V11M4.5 8h7"/>',
    chev: '<path d="M6 4l4 4-4 4"/>',
  };
  const icon = (n) => `<svg class="i" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[n]}</svg>`;

  // Popover grouping (display only; report keeps RULES order).
  const GROUPS = [
    ['Content', ['badges', 'labels', 'headlines', 'copytells', 'weakcta', 'emdash', 'product', 'faq', 'logobar']],
    ['Typography', ['fonts', 'italics', 'mono', 'scale', 'wrap', 'tabular', 'optical']],
    ['Layout', ['system', 'enlarge', 'group', 'nest', 'toprow', 'radius']],
    ['Colour & detail', ['cta', 'accent', 'neutrals', 'contrast', 'icons', 'embellish']],
    ['Accessibility', ['targets', 'alt', 'iconlabels', 'mediaspace', 'deadlinks', 'fakebuttons', 'pointer', 'fieldlabels', 'headingorder']],
    ['Responsive', ['mobilefit', 'hscroll', 'smalltext']],
    ['Banned patterns', ['stripes', 'heavyborder', 'gradtext', 'heroMetric', 'cardGrid', 'bggrid', 'arrows', 'statusdot', 'terminal']],
    ['Behaviour', ['loading', 'motion', 'heroimg']],
  ];
  // Colour coding: one hue per group at the same lightness and chroma, so groups read as equals.
  const GROUP_COLOR = {
    'Content': 'oklch(78% 0.11 35)', 'Typography': 'oklch(80% 0.11 85)', 'Layout': 'oklch(78% 0.11 150)',
    'Colour & detail': 'oklch(76% 0.11 305)', 'Accessibility': 'oklch(78% 0.10 235)', 'Responsive': 'oklch(78% 0.10 195)',
    'Banned patterns': 'oklch(74% 0.12 10)', 'Behaviour': 'oklch(80% 0.11 120)',
  };
  const RULE_COLOR = Object.fromEntries(GROUPS.flatMap(([g, ids]) => ids.map((id) => [id, GROUP_COLOR[g]])));

  shadow.innerHTML = `
<style>
  /* Brand: cobalt-tinted navy surfaces, warm cream text, capybara orange as the one accent, espresso on orange. */
  :host { --bg: oklch(23% 0.035 258); --bg2: oklch(28% 0.04 258); --line: oklch(90% 0.03 258 / .1); --fg: oklch(95% 0.018 80); --mute: oklch(76% 0.025 258);
          --dim: oklch(55% 0.03 258); --acc: oklch(69% 0.125 62); --acc-hi: oklch(75% 0.115 66); --acc-wash: oklch(69% 0.125 62 / .15); --on-acc: oklch(30% 0.045 55); --red: oklch(64% 0.19 28);
          --cobalt: oklch(49% 0.11 258);
          --r-outer:12px; --pad:6px; --r-inner:6px; }
  .bar, .pop, .drawer, .toast { font: 13px/1.45 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: var(--fg); text-align: left; letter-spacing: normal; -webkit-font-smoothing: antialiased; }
  * { box-sizing: border-box; }
  button { font: inherit; color: inherit; cursor: pointer; border: 0; background: none; margin: 0; }
  .i { width: 16px; height: 16px; flex-shrink: 0; display: block; }
  /* Scrollbars from the same tokens: thin, dim thumb, transparent track; brighter while the panel is hovered. */
  .list, .drawer { overscroll-behavior: contain; scrollbar-width: thin; scrollbar-color: var(--dim) transparent; scrollbar-gutter: stable; }
  .list:hover, .drawer:hover { scrollbar-color: var(--mute) transparent; }

  .bar { position: fixed; top: 0; left: 0; right: 0; height: 48px; display: flex; align-items: center; gap: 8px; padding: 0 8px 0 16px;
         background: var(--bg); border-bottom: 1px solid var(--line); transform: translateY(-100%); transition: transform .24s cubic-bezier(.16,1,.3,1); pointer-events: auto; }
  .bar.open { transform: none; }
  .brand { font-weight: 600; display: flex; align-items: center; gap: 8px; margin-right: auto; }
  .logo { width: 24px; height: 24px; border-radius: 50%; display: block; background: var(--cobalt); }
  .sep { width: 1px; height: 20px; background: var(--line); margin: 0 4px; }
  .badge { min-width: 20px; height: 20px; padding: 0 6px; border-radius: 10px; background: var(--bg2); color: var(--fg); font: 600 11px/20px ui-sans-serif, system-ui, sans-serif;
           text-align: center; font-variant-numeric: tabular-nums; }
  .badge[hidden] { display: none; }
  .count.zero .badge { color: var(--dim); }

  .btn { height: 32px; padding: 0 12px; border-radius: 8px; display: inline-flex; align-items: center; gap: 8px; white-space: nowrap; color: var(--fg); transition: background-color .15s, color .15s, transform .1s ease-out; }
  .btn:has(.i:first-child) { padding-left: 10px; }
  .btn:hover { background: rgba(255,255,255,.06); }
  .btn:active { transform: scale(.97); }
  .btn:focus-visible, .row:has(input:focus-visible) { outline: 2px solid var(--acc); outline-offset: 2px; }
  .btn.primary { background: var(--acc); color: var(--on-acc); font-weight: 600; }
  .btn.primary:hover { background: var(--acc-hi); }
  .btn.primary.done { background: var(--bg2); color: var(--fg); }
  .btn[disabled] { background: var(--bg2); color: var(--dim); pointer-events: none; }
  .btn.icon { width: 32px; padding: 0; justify-content: center; color: var(--mute); }
  .btn.icon:hover { color: var(--fg); }
  .toggle[aria-pressed=true] { color: var(--acc-hi); background: var(--acc-wash); }
  .num { font-variant-numeric: tabular-nums; }

  .hl { position: fixed; pointer-events: none; outline: 1.5px solid var(--acc); background: var(--acc-wash); display: none; }
  .hl.locked { outline: 2px solid var(--acc); background: transparent; }
  .hl.locked span { display: none; }
  .hl span { position: absolute; left: -2px; bottom: 100%; margin-bottom: 6px; background: var(--acc); color: var(--on-acc); font: 500 11px/1 ui-monospace, Menlo, monospace;
             padding: 4px 6px; border-radius: 4px; white-space: nowrap; font-variant-numeric: tabular-nums; }

  .pop { position: fixed; width: 344px; max-height: min(640px, calc(100vh - 68px)); display: none; flex-direction: column;
         background: var(--bg); border: 1px solid var(--line); border-radius: var(--r-outer); box-shadow: 0 4px 16px rgba(0,0,0,.24); pointer-events: auto; overflow: hidden; }
  .pop.open { display: flex; animation: in .18s cubic-bezier(.16,1,.3,1); }
  @keyframes in { from { opacity: 0; transform: translateY(4px); } }
  .ph { padding: 12px 8px 12px 16px; display: flex; align-items: flex-start; gap: 4px; }
  .ph .t { flex: 1; min-width: 0; padding-top: 2px; }
  .ph .t b { display: block; font-size: 14px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ph .t code { display: block; margin-top: 2px; color: var(--mute); font: 12px/1.4 ui-monospace, Menlo, monospace; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .list { overflow-y: auto; padding: 0 var(--pad) var(--pad); flex: 1; }
  .cmp { display: flex; align-items: center; gap: 8px; margin: 0 var(--pad) 8px; padding: 8px 10px; border-radius: var(--r-inner); background: var(--bg2); cursor: pointer; user-select: none; }
  .cmp.off { cursor: default; color: var(--dim); }
  .cmp .l { flex: 1; font-weight: 500; }
  .cmp .s { color: var(--mute); font-size: 12px; font-variant-numeric: tabular-nums; }
  .cmp kbd { font: 12px/1 ui-monospace, Menlo, monospace; color: var(--mute); border: 1px solid var(--line); border-radius: 4px; padding: 2px 4px; }
  .sw { position: relative; width: 32px; height: 18px; border-radius: 9px; background: oklch(32% 0.01 265); flex-shrink: 0; transition: background-color .15s; }
  .sw::after { content: ''; position: absolute; top: 2px; left: 2px; width: 14px; height: 14px; border-radius: 50%; background: var(--on-acc); transition: transform .15s ease-out; }
  .sw[aria-checked=true] { background: var(--acc); }
  .sw[aria-checked=true]::after { transform: translateX(14px); }
  .sw:focus-visible { outline: 2px solid var(--acc); outline-offset: 2px; }
  .sw[disabled] { opacity: .4; pointer-events: none; }
  /* Group colour coding: --g is set per group. Tinted header, coloured checkboxes and notes; no stripes or boxed sections. */
  /* Chip row scrolls sideways: same thin scrollbar as the list, plus drag-to-slide and wheel-to-scroll (see JS). */
  .gchips { display: flex; flex-shrink: 0; gap: 6px; overflow-x: auto; padding: 0 var(--pad) 6px; margin-bottom: 4px; overscroll-behavior-x: contain;
            scrollbar-width: thin; scrollbar-color: var(--dim) transparent; cursor: grab; user-select: none; }
  .gchips:hover { scrollbar-color: var(--mute) transparent; }
  .gchips.drag, .gchips.drag .gchip { cursor: grabbing; }
  .gchip { cursor: pointer; flex-shrink: 0; display: inline-flex; align-items: center; gap: 6px; height: 26px; padding: 0 10px; border-radius: 999px; font-size: 12px; color: var(--mute);
           background: color-mix(in oklch, var(--g) 10%, transparent); transition: background-color .15s, color .15s; }
  .gchip::before { content: ''; width: 8px; height: 8px; border-radius: 50%; background: var(--g); }
  .gchip:hover, .gchip.on { color: var(--fg); background: color-mix(in oklch, var(--g) 22%, transparent); }
  .grp + .grp { margin-top: 10px; }
  .gh { display: flex; align-items: center; gap: 10px; margin-bottom: 2px; font-size: 12px; font-weight: 600; color: var(--fg); padding: 7px 10px; border-radius: var(--r-inner);
        background: color-mix(in oklch, var(--g) 14%, transparent); cursor: pointer; user-select: none; transition: background-color .15s; }
  .gh:hover { background: color-mix(in oklch, var(--g) 22%, transparent); }
  .gh .gdot { width: 8px; height: 8px; border-radius: 50%; background: var(--g); flex-shrink: 0; }
  .all { display: flex; align-items: center; gap: 12px; margin: 0 0 8px; padding: 8px 10px; border-radius: var(--r-inner); font-weight: 600; cursor: pointer; user-select: none; }
  .all:hover { background: rgba(255,255,255,.05); }
  .gh input, .all input { appearance: none; width: 16px; height: 16px; margin: 0; flex-shrink: 0; border: 1.5px solid var(--dim); border-radius: 4px; display: grid; place-content: center; cursor: pointer; transition: background-color .12s, border-color .12s; outline: none; }
  .gh input:checked, .all input:checked, .gh input:indeterminate, .all input:indeterminate { background: var(--acc); border-color: var(--acc); }
  .gh input:checked, .gh input:indeterminate { background: var(--g); border-color: var(--g); }
  .gh input:checked::after, .all input:checked::after { content: ''; width: 8px; height: 4px; border: 2px solid var(--on-acc); border-top: 0; border-right: 0; transform: translate(0,-1px) rotate(-45deg); }
  .gh input:indeterminate::after, .all input:indeterminate::after { content: ''; width: 8px; height: 2px; background: var(--on-acc); border-radius: 1px; }
  .gh:has(input:focus-visible), .all:has(input:focus-visible) { outline: 2px solid var(--acc); outline-offset: 2px; }
  .row { display: grid; grid-template-columns: 16px 1fr; gap: 2px 12px; align-items: start; padding: 8px 10px; border-radius: var(--r-inner); cursor: pointer; user-select: none; transition: background-color .12s; }
  .row:hover { background: rgba(255,255,255,.05); }
  .row input { appearance: none; width: 16px; height: 16px; margin: 2px 0 0; border: 1.5px solid var(--dim); border-radius: 4px; display: grid; place-content: center; cursor: pointer; transition: background-color .12s, border-color .12s; outline: none; }
  .row input:checked { background: var(--g, var(--acc)); border-color: var(--g, var(--acc)); }
  .row input:checked::after { content: ''; width: 8px; height: 4px; border: 2px solid var(--on-acc); border-top: 0; border-right: 0; transform: translate(0,-1px) rotate(-45deg); }
  .lbl { font-weight: 500; }
  .hint { grid-column: 2; color: var(--mute); font-size: 12px; text-wrap: pretty; }
  .agent { grid-column: 2; display: flex; align-items: center; gap: 6px; color: var(--mute); font-size: 12px; margin-top: 2px; }
  .agent::before { content: ''; width: 10px; height: 10px; border: 1.5px dashed var(--red); border-radius: 2px; flex-shrink: 0; }
  .notes { grid-column: 2; margin: 6px 0 0; padding: 6px 8px; list-style: none; font-size: 12px; color: var(--fg); background: color-mix(in oklch, var(--g, var(--acc)) 13%, transparent); border-radius: 4px; font-variant-numeric: tabular-nums; }
  .notes li + li { margin-top: 2px; }
  .pf { display: flex; gap: 8px; align-items: center; padding: 12px 12px 12px 16px; border-top: 1px solid var(--line); }
  .pf .sp { flex: 1; color: var(--mute); font-size: 12px; font-variant-numeric: tabular-nums; }

  .drawer { position: fixed; top: 56px; right: 8px; width: 380px; max-height: calc(100vh - 72px); overflow-y: auto; display: none;
            background: var(--bg); border: 1px solid var(--line); border-radius: var(--r-outer); box-shadow: 0 4px 16px rgba(0,0,0,.24); pointer-events: auto; padding: var(--pad); }
  .drawer.open { display: block; animation: in .18s cubic-bezier(.16,1,.3,1); }
  .scan { width: 392px; padding: 0; }
  .sh { padding: 14px 16px 12px; }
  .sh b { display: block; font-size: 14px; font-weight: 600; }
  .sh p { margin: 2px 0 0; color: var(--mute); font-size: 12px; font-variant-numeric: tabular-nums; }
  .prof { display: grid; grid-template-columns: auto 1fr; gap: 6px 16px; margin: 0 var(--pad) var(--pad); padding: 10px; border-radius: var(--r-inner); background: var(--bg2); font-size: 12px; }
  .prof dt { color: var(--mute); }
  .prof dd { margin: 0; font-variant-numeric: tabular-nums; }
  .ft { display: inline-flex; align-items: center; gap: 4px; margin-right: 8px; }
  .ft.slop { color: oklch(78% 0.13 60); }
  .ft.slop::after { content: attr(data-tier); font-size: 11px; padding: 0 4px; border-radius: 4px; background: oklch(78% 0.13 60 / .14); }
  .fnd { margin: 0 var(--pad); }
  .fnd + .fnd { margin-top: 2px; }
  .sdot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: var(--g); margin-right: 8px; vertical-align: 1px; }
  .fnd summary { list-style: none; display: grid; grid-template-columns: 16px 1fr auto; gap: 0 10px; align-items: center; padding: 8px 10px; border-radius: var(--r-inner); cursor: pointer; }
  .fnd summary::-webkit-details-marker { display: none; }
  .fnd summary:hover { background: rgba(255,255,255,.05); }
  .fnd summary .i { color: var(--mute); transition: transform .15s cubic-bezier(.16,1,.3,1); }
  .fnd[open] summary .i { transform: rotate(90deg); }
  .fnd .n { font-variant-numeric: tabular-nums; color: var(--mute); font-size: 12px; min-width: 24px; text-align: right; }
  .fnd .sub { grid-column: 2 / 4; color: var(--mute); font-size: 12px; }
  .fnd ul { list-style: none; margin: 0 0 6px; padding: 0 0 0 26px; }
  .fnd li button { width: 100%; text-align: left; padding: 6px 10px; border-radius: var(--r-inner); color: var(--fg); font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; }
  .fnd li button:hover { background: var(--acc-wash); }
  .fnd .more { color: var(--mute); font-size: 12px; padding: 4px 10px; }
  .sf { position: sticky; bottom: 0; padding: 10px 16px; margin-top: 8px; border-top: 1px solid var(--line); background: var(--bg); color: var(--mute); font-size: 12px; }
  .scanning { padding: 32px 16px; color: var(--mute); }
  .bar-track { height: 4px; border-radius: 2px; background: var(--bg2); margin-top: 10px; overflow: hidden; }
  .bar-track span { display: block; height: 100%; background: var(--acc); transition: width .2s cubic-bezier(.16,1,.3,1); }
  .item { padding: 10px 6px 12px 10px; border-radius: var(--r-inner); display: grid; grid-template-columns: 1fr auto; gap: 4px 8px; }
  .item + .item { margin-top: 2px; }
  .item:hover { background: rgba(255,255,255,.04); }
  .item b { font-weight: 500; display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .item code { display: block; font: 12px/1.4 ui-monospace, Menlo, monospace; color: var(--mute); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .item .btn.icon { width: 28px; height: 28px; }
  .chips { grid-column: 1 / 3; display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
  .chip { font-size: 12px; color: var(--fg); background: var(--bg2); border-radius: 4px; padding: 2px 6px; }
  .empty { padding: 20px 16px 24px; color: var(--mute); text-wrap: pretty; text-align: center; }
  .empty img { width: 112px; height: 112px; border-radius: 50%; display: block; margin: 0 auto 12px; background: var(--cobalt); }
  .empty b { display: block; color: var(--fg); font-weight: 500; margin-bottom: 4px; }

  .mk { position: fixed; pointer-events: none; background: var(--red); color: var(--on-acc); padding: 2px 6px; border-radius: 4px; white-space: nowrap;
        font: 500 11px/1.4 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; }
  .toast { position: fixed; left: 50%; bottom: 24px; transform: translate(-50%, 8px); opacity: 0; background: var(--bg); border: 1px solid var(--line);
           padding: 8px 12px; border-radius: 8px; transition: opacity .16s, transform .16s; pointer-events: none; }
  .toast.show { opacity: 1; transform: translate(-50%, 0); }
  @media (prefers-reduced-motion: reduce) { .bar, .btn, .row, .toast { transition: none; } .pop.open, .drawer.open { animation: none; } }
</style>
<!-- Marks come first so the bar, rules panel and drawers paint over their tags. -->
<div class="marks"></div>
<div class="bar">
  <div class="brand"><img class="logo" src="${assetURL('avatar.png')}" alt="">Yba</div>
  <button class="btn toggle" data-act="inspect" aria-pressed="true">${icon('target')}Inspect</button>
  <button class="btn scanbtn" data-act="scan" title="Scan the whole page">${icon('scan')}<span>Scan</span><b class="badge" hidden></b></button>
  <button class="btn count zero" data-act="list" title="Approved components" aria-label="Approved components">${icon('list')}<b class="badge num">0</b></button>
  <span class="sep" aria-hidden="true"></span>
  <button class="btn primary" data-act="copy" disabled>${icon('copy')}<span>Copy for agent</span></button>
  <button class="btn icon" data-act="close" title="Close (Esc)" aria-label="Close">${icon('x')}</button>
</div>
<div class="hl"><span></span></div>
<div class="pop" role="dialog" aria-label="Yba rules">
  <div class="ph"><div class="t"><b></b><code></code></div>
    <button class="btn icon" data-act="parent" title="Select parent (↑)" aria-label="Select parent">${icon('up')}</button>
    <button class="btn icon" data-act="pclose" title="Close (Esc)" aria-label="Close">${icon('x')}</button></div>
  <div class="cmp" data-act="compare"><span class="l">Show changes</span><span class="s"></span><kbd title="Keyboard shortcut">H</kbd>
    <button class="sw" role="switch" aria-checked="true" aria-label="Show changes" data-act="compare"></button></div>
  <div class="gchips" role="navigation" aria-label="Jump to a rule group"></div>
  <div class="list"></div>
  <div class="pf"><span class="sp"></span><button class="btn" data-act="reset">Reset</button><button class="btn primary" data-act="approve" disabled>Approve</button></div>
</div>
<div class="drawer"></div>
<div class="drawer scan" role="region" aria-label="Page scan"></div>
<div class="toast" role="status"></div>`;

  const $ = (q) => shadow.querySelector(q);
  const bar = $('.bar'), hl = $('.hl'), pop = $('.pop'), list = $('.list'), drawer = $('.drawer:not(.scan)'), scanPanel = $('.scan'), toastEl = $('.toast');

  let open = false, inspecting = true, hovered = null, current = null; // current = open session
  const HINT = 'Click any component to deslop it · ↑ selects its parent';

  // ── bar ──
  function setOpen(v) {
    open = v; barOpen = v;
    if (v && !host.isConnected) document.documentElement.appendChild(host);
    requestAnimationFrame(() => { bar.classList.toggle('open', v); renderMarks(); });
    pushPage(v);
    if (v) { setInspect(true); restorePreviews(); startScan(); toast(HINT, 4000); }
    else { closePop(); setInspect(false); drawer.classList.remove('open'); scanPanel.classList.remove('open'); }
  }
  function setInspect(v) {
    inspecting = v;
    bar.classList.toggle('inspecting', v);
    const btn = $('[data-act=inspect]');
    btn.setAttribute('aria-pressed', String(v));
    btn.title = v ? `${HINT} (click to turn off)` : 'Inspect is off, so page clicks work normally';
    if (!v && !current) hl.style.display = 'none';
  }
  function refreshCount() {
    const fixes = approved.reduce((n, a) => n + a.rules.length, 0);
    const n = approved.length, count = $('[data-act=list]');
    count.querySelector('.badge').textContent = n;
    count.classList.toggle('zero', !n);
    count.title = n ? `${n} approved component${n === 1 ? '' : 's'} · ${fixes} fix${fixes === 1 ? '' : 'es'}` : 'Approved components';
    count.setAttribute('aria-label', count.title);
    $('[data-act=copy]').disabled = !approved.length && !scanResult?.findings.length;
    renderDrawer();
  }
  function toast(t, ms = 1800) { toastEl.textContent = t; toastEl.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => toastEl.classList.remove('show'), ms); }

  // ── highlight ──
  function label(el) {
    const cls = [...el.classList].filter((c) => !c.startsWith('data-yba')).slice(0, 2).map((c) => '.' + c).join('');
    const r = el.getBoundingClientRect();
    return `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${cls}  ${Math.round(r.width)}×${Math.round(r.height)}`;
  }
  function drawHL(el, locked) {
    if (!el) { hl.style.display = 'none'; return; }
    const r = el.getBoundingClientRect();
    Object.assign(hl.style, { display: 'block', left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
    hl.classList.toggle('locked', !!locked);
    hl.firstElementChild.textContent = label(el);
    hl.firstElementChild.style.bottom = r.top < 70 ? 'auto' : '100%';
    hl.firstElementChild.style.top = r.top < 70 ? '4px' : 'auto';
  }

  // ── popover ──
  function openPop(el) {
    if (current && current.el !== el) closePop();
    const s = getSession(el); current = s; showing = true; scanPanel.classList.remove('open');
    $('.ph b').textContent = niceName(el);
    $('.ph code').textContent = s.selector;
    renderList(); pop.classList.add('open'); placePop(); drawHL(el, true);
    $('[data-act=parent]').disabled = !el.parentElement || el.parentElement === document.body.parentElement;
  }
  // Human name for the element: its heading, label, or first words; falls back to the tag.
  function niceName(el) {
    const h = el.matches('h1,h2,h3,h4,h5,h6') ? el : el.querySelector('h1,h2,h3,h4,h5,h6');
    const t = (h?.textContent || el.getAttribute('aria-label') || el.innerText || '').trim();
    return t ? short(t, 40) : `<${el.tagName.toLowerCase()}>`;
  }
  // Before/after compare: hiding reverts the overrides without losing checks or notes.
  let showing = true;
  function setShowing(v) {
    if (!current || (!v && !current.checked.size)) v = true;
    if (v === showing) return syncCompare();
    showing = v;
    if (current) { v ? applyRules(current) : revert(current); drawHL(current.el, true); renderList(); } // renderList refreshes footer + switch
  }
  function syncCompare() {
    if (!current) return;
    const n = current.checked.size;
    const sw = $('.sw');
    sw.setAttribute('aria-checked', String(showing)); sw.disabled = !n;
    $('.cmp').classList.toggle('off', !n);
    $('.cmp .s').textContent = !n ? '' : showing ? 'After' : 'Original';
    if (!showing) $('.pf .sp').textContent = 'Showing original';
  }
  function closePop() {
    if (!current) return;
    if (!showing && current.approved) applyRules(current);
    showing = true;
    if (!current.approved) discard(current);
    current = null; hovered = null; pop.classList.remove('open'); hl.classList.remove('locked'); hl.style.display = 'none';
  }
  function renderList() {
    const s = current;
    const row = (r) => `
      <label class="row" data-id="${r.id}">
        <input type="checkbox" ${s.checked.has(r.id) ? 'checked' : ''}>
        <span class="lbl">${r.label}</span>
        <span class="hint">${r.hint}</span>
        ${r.auto === 'mark' ? '<span class="agent">Outlined on page · agent makes the change</span>' : ''}
        ${s.checked.has(r.id) && s.notes[r.id]?.length ? `<ul class="notes">${s.notes[r.id].map((n) => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}
      </label>`;
    const scroll = list.scrollTop;
    const state = (ids) => { const on = ids.filter((id) => s.checked.has(id)).length; return on === 0 ? 'none' : on === ids.length ? 'all' : 'some'; };
    const allIds = RULES.map((r) => r.id);
    list.innerHTML = `<label class="all"><input type="checkbox" data-toggle="all" aria-label="Toggle all rules"${state(allIds) === 'all' ? ' checked' : ''}><span>All rules</span></label>`
      + GROUPS.map(([name, ids], gi) => `<div class="grp" data-grp="${gi}" style="--g: ${GROUP_COLOR[name]}"><label class="gh"><input type="checkbox" data-toggle="${gi}" aria-label="Toggle all ${esc(name)} rules"${state(ids) === 'all' ? ' checked' : ''}><span class="gdot"></span><span>${name}</span></label>${ids.map((id) => row(RULE[id])).join('')}</div>`).join('');
    // Colour chips jump to a group; a group with checked rules shows its chip filled.
    $('.gchips').innerHTML = GROUPS.map(([name, ids], gi) => `<button type="button" class="gchip${state(ids) !== 'none' ? ' on' : ''}" data-jump="${gi}" style="--g: ${GROUP_COLOR[name]}">${name}</button>`).join('');
    // Partly-checked groups (and the All row) show a dash; indeterminate is a property, not an attribute.
    list.querySelector('[data-toggle="all"]').indeterminate = state(allIds) === 'some';
    GROUPS.forEach(([, ids], gi) => { list.querySelector(`[data-toggle="${gi}"]`).indeterminate = state(ids) === 'some'; });
    list.scrollTop = scroll;
    const n = s.checked.size;
    $('.pf .sp').textContent = s.approved ? `Approved · ${n} rule${n === 1 ? '' : 's'}` : n ? `Previewing ${n} rule${n > 1 ? 's' : ''}` : 'Check a rule to preview it';
    const btn = $('[data-act=approve]');
    btn.textContent = s.approved ? (n ? 'Update' : 'Remove') : 'Approve';
    btn.disabled = !s.approved && !n;
    syncCompare();
  }
  const esc = (t) => t.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);

  function placePop() {
    if (!current) return;
    const r = current.el.getBoundingClientRect();
    const W = 344, H = pop.offsetHeight || 500, vw = innerWidth, vh = innerHeight, m = 12, top0 = 60;
    // Beside the element if it fits, otherwise pinned to the right edge of the viewport.
    const left = r.right + m + W <= vw - m ? r.right + m : r.left - W - m >= m ? r.left - W - m : vw - W - m;
    const top = Math.max(top0, Math.min(r.top, vh - H - m));
    pop.style.left = Math.max(m, left) + 'px'; pop.style.top = top + 'px';
  }

  // Chip row: drag to slide sideways, and map vertical wheel to horizontal scroll.
  const gchips = $('.gchips');
  let drag = null, dragged = false;
  gchips.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || e.pointerType === 'touch') return; // touch already scrolls natively
    drag = { x: e.clientX, left: gchips.scrollLeft, id: e.pointerId }; dragged = false;
  });
  gchips.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x;
    if (!dragged && Math.abs(dx) < 4) return;
    if (!dragged) { dragged = true; gchips.classList.add('drag'); gchips.setPointerCapture(drag.id); }
    gchips.scrollLeft = drag.left - dx;
  });
  const endDrag = () => { drag = null; gchips.classList.remove('drag'); };
  gchips.addEventListener('pointerup', endDrag);
  gchips.addEventListener('pointercancel', endDrag);
  gchips.addEventListener('wheel', (e) => {
    if (Math.abs(e.deltaY) <= Math.abs(e.deltaX) || gchips.scrollWidth <= gchips.clientWidth) return;
    e.preventDefault(); gchips.scrollLeft += e.deltaY;
  }, { passive: false });

  // Colour chips scroll the rule list to their group (unless the pointer was dragging the row).
  gchips.addEventListener('click', (e) => {
    if (dragged) { dragged = false; e.preventDefault(); return; }
    const chip = e.target.closest('[data-jump]'); if (!chip) return;
    const grp = list.querySelector(`[data-grp="${chip.dataset.jump}"]`); if (!grp) return;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    list.scrollTo({ top: grp.offsetTop - list.offsetTop - 4, behavior: reduce ? 'auto' : 'smooth' });
  });

  list.addEventListener('change', (e) => {
    if (!current) return;
    const toggle = e.target.dataset.toggle;
    if (toggle !== undefined) {
      const ids = toggle === 'all' ? RULES.map((r) => r.id) : GROUPS[+toggle][1];
      // Clicking a partly-checked box checks the rest; clicking a full one clears it.
      const turnOn = !ids.every((id) => current.checked.has(id));
      ids.forEach((id) => (turnOn ? current.checked.add(id) : current.checked.delete(id)));
      showing = true; applyRules(current); renderList(); drawHL(current.el, true); placePop();
      return;
    }
    const row = e.target.closest('.row'); if (!row) return;
    const id = row.dataset.id;
    e.target.checked ? current.checked.add(id) : current.checked.delete(id);
    showing = true; applyRules(current); renderList(); drawHL(current.el, true); placePop();
  });

  function approve() {
    const s = current; if (!s) return;
    if (!showing) { showing = true; applyRules(s); }
    approved = approved.filter((a) => a.sid !== s.id);
    if (!s.checked.size) { discard(s); current = null; hovered = null; pop.classList.remove('open'); hl.classList.remove('locked'); hl.style.display = 'none'; toast('Removed from instructions'); }
    else {
      s.approved = true;
      approved.push(serialise(s));
      toast(`Added · ${s.checked.size} fix${s.checked.size > 1 ? 'es' : ''}`);
      current = null; hovered = null; pop.classList.remove('open'); hl.classList.remove('locked'); hl.style.display = 'none';
    }
    persist(); refreshCount();
  }
  function serialise(s) {
    return {
      sid: s.id, selector: s.selector, tag: s.el.tagName.toLowerCase(), name: niceName(s.el),
      text: short(s.el.innerText || s.el.textContent || '', 140), html: s.html,
      rules: RULES.filter((r) => s.checked.has(r.id)).map((r) => r.id),
      notes: Object.fromEntries([...s.checked].map((id) => [id, s.notes[id] || []])),
    };
  }
  const persist = () => store.set(approved.map(({ sid, ...rest }) => rest));

  // Re-find approved selectors after reload and re-apply their previews.
  function restorePreviews() {
    for (const a of approved) {
      if (a.sid && [...sessions.values()].some((s) => s.id === a.sid)) continue;
      let el = null; try { el = document.querySelector(a.selector); } catch { /* invalid */ }
      if (!el || sessions.has(el)) continue;
      const s = getSession(el); s.html = a.html; s.approved = true; a.rules.forEach((r) => s.checked.add(r));
      applyRules(s); a.sid = s.id;
    }
  }

  // ── drawer ──
  function renderDrawer() {
    drawer.innerHTML = approved.length ? approved.map((a, i) => `
      <div class="item">
        <div style="min-width:0"><b>${esc(a.name || short(a.text || a.tag, 44))}</b><code>${esc(a.selector)}</code></div>
        <button class="btn icon" data-rm="${i}" title="Remove from instructions" aria-label="Remove">${icon('x')}</button>
        <div class="chips">${a.rules.map((r) => `<span class="chip">${RULE[r].label}</span>`).join('')}</div>
      </div>`).join('') : `<div class="empty"><img src="${assetURL('mascot.jpg')}" alt=""><b>Nothing approved yet</b>Click a component, check the rules you want, then approve it to add it here.</div>`;
  }
  drawer.addEventListener('click', (e) => {
    const b = e.target.closest('[data-rm]'); if (!b) return;
    const a = approved[+b.dataset.rm];
    const s = [...sessions.values()].find((x) => x.id === a.sid); if (s) discard(s);
    approved.splice(+b.dataset.rm, 1); persist(); refreshCount();
  });

  // ── report ──
  // ── scan panel ──
  async function startScan() {
    if (scanning) return;
    drawer.classList.remove('open'); scanPanel.classList.add('open');
    const btn = $('[data-act=scan] span'); btn.textContent = 'Scanning…'; $('[data-act=scan] .badge').hidden = true;
    await runScan((i, n) => {
      scanPanel.innerHTML = `<div class="scanning"><b style="color:var(--fg);font-weight:500">Scanning page for slop</b><br>Checking ${RULE[SCAN_RULES[i]].label.toLowerCase()} (${i + 1}/${n})<div class="bar-track"><span style="width:${Math.round(((i + 1) / n) * 100)}%"></span></div></div>`;
    });
    renderScan(); refreshCount();
  }
  function renderScan() {
    const r = scanResult; if (!r) return;
    const total = r.findings.reduce((n, f) => n + f.els.length, 0);
    $('[data-act=scan] span').textContent = 'Scan';
    const badge = $('[data-act=scan] .badge'); badge.textContent = total; badge.hidden = !total;
    $('[data-act=scan]').title = total ? `${total} slop signal${total === 1 ? '' : 's'} on this page · click to scan again` : 'Scan the whole page';
    const p = r.profile;
    const fonts = p.fonts.map((f) => `<span class="ft${f.tier ? ' slop' : ''}" data-tier="${f.tier === 'ai' ? 'AI default' : f.tier ? 'generic' : ''}">${esc(f.name)} <span style="color:var(--mute)">${f.share}%</span></span>`).join('');
    scanPanel.innerHTML = `
      ${total ? '' : `<div class="empty"><img src="${assetURL('success.png')}" alt=""><b>This page looks hand-made</b>None of the ${SCAN_RULES.length} scan rules found anything. Inspect a component to check the rest.</div>`}
      <div class="sh"${total ? '' : ' hidden'}><b>${total} slop signals on this page</b>
        <p>${r.findings.length} rule${r.findings.length === 1 ? '' : 's'} triggered · click an item to open it with that rule checked</p></div>
      <dl class="prof">
        <dt>Fonts</dt><dd>${fonts || 'none'}</dd>
        <dt>Colours</dt><dd>${p.colours} distinct text + background</dd>
        <dt>Corners</dt><dd>${p.radii.length ? p.radii.map((x) => x + 'px').join(', ') : 'none'}</dd>
        <dt>Effects</dt><dd>${p.gradients} gradient${p.gradients === 1 ? '' : 's'}, ${p.shadows} shadow${p.shadows === 1 ? '' : 's'}</dd>
      </dl>
      ${r.findings.map((f, fi) => `
        <details class="fnd" data-fi="${fi}"${fi < 2 ? ' open' : ''}>
          <summary>${icon('chev')}<span><span class="sdot" style="--g: ${RULE_COLOR[f.id]}"></span>${RULE[f.id].label}</span><span class="n">${f.els.length}</span>
            <span class="sub">${esc(scanNote(f.notes.find((n) => !/^No |…and|^Preview/.test(n)) || RULE[f.id].hint))}</span></summary>
          <ul>${f.els.slice(0, 8).map((el, ei) => `<li><button data-fi="${fi}" data-ei="${ei}">${esc(niceName(el))}</button></li>`).join('')}
          ${f.els.length > 8 ? `<li class="more">+${f.els.length - 8} more</li>` : ''}</ul>
        </details>`).join('')}
      <div class="sf">Copy for agent includes these findings as page-wide fixes.</div>`;
  }
  function focusFinding(fi, ei) {
    const f = scanResult?.findings[fi]; const el = f?.els[ei]; if (!el?.isConnected) return;
    scanPanel.classList.remove('open');
    const comp = componentFor(el);
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    setTimeout(() => {
      openPop(comp);
      if (!current.checked.has(f.id)) { current.checked.add(f.id); showing = true; applyRules(current); renderList(); }
      const row = list.querySelector(`.row[data-id="${f.id}"]`); if (row) list.scrollTop = row.offsetTop - 80;
      placePop();
    }, 380);
  }
  scanPanel.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-ei]'); if (b) focusFinding(+b.dataset.fi, +b.dataset.ei);
  });
  scanPanel.addEventListener('mouseover', (e) => {
    const b = e.target.closest('button[data-ei]'); if (!b || current) return;
    const el = scanResult?.findings[+b.dataset.fi]?.els[+b.dataset.ei]; if (el?.isConnected) { hovered = el; drawHL(el, false); }
  });

  function buildReport() {
    const lines = [
      `# Yba instructions`, ``,
      `**Page:** ${document.title || '(untitled)'} (${location.href})`,
      `**Generated:** ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`, ``,
      `Apply the UI fixes below in the source code. Each component is identified by a CSS selector, its visible text, and an HTML snapshot taken before any preview overrides. Find the component in the codebase that renders it and change the source (components, styles, tokens), not inline overrides. Apply each fix to every instance of the same component, including ones not shown here. "Observed" lines show what the live preview changed; treat the values as hints.`, ``,
    ];
    if (scanResult?.findings.length) {
      const p = scanResult.profile;
      lines.push(`## Page-wide scan`, ``, `Yba found these patterns across the whole page. Fix them at the source (tokens, shared components, global styles) so every instance changes.`, ``);
      lines.push(`**Fonts:** ${p.fonts.map((f) => `${f.name} ${f.share}%${f.tier ? ` (${f.tier === 'ai' ? 'AI default' : 'generic default'})` : ''}`).join(', ') || 'none'}`);
      lines.push(`**Palette:** ${p.colours} distinct text/background colours, ${p.gradients} gradients, ${p.shadows} shadows. **Radii:** ${p.radii.map((x) => x + 'px').join(', ') || 'none'}`, ``);
      for (const f of scanResult.findings) {
        const r = RULE[f.id];
        lines.push(`- **${r.label}** (${f.els.length} element${f.els.length > 1 ? 's' : ''}): ${r.agent}`);
        for (const n of f.notes.filter((n) => !/^No |^Preview/.test(n)).slice(0, 4)) lines.push(`  - Found: ${scanNote(n)}`);
        const ex = f.els.slice(0, 3).map((el) => `\`${selectorFor(el)}\``).join(', ');
        if (ex) lines.push(`  - Examples: ${ex}`);
      }
      lines.push('');
    }
    if (approved.length) lines.push(`## Components`, ``);
    approved.forEach((a, i) => {
      lines.push(`### ${i + 1}. \`${a.selector}\``, ``);
      if (a.text) lines.push(`**Visible text:** "${a.text}"`, ``);
      lines.push('```html', a.html, '```', '', '**Fixes:**', '');
      for (const id of a.rules) {
        const r = RULE[id];
        lines.push(`- **${r.label}:** ${r.agent}`);
        for (const n of a.notes[id] || []) lines.push(`  - Observed: ${n}`);
      }
      lines.push('');
    });
    return lines.join('\n');
  }
  async function copyReport() {
    const text = buildReport();
    try { await navigator.clipboard.writeText(text); }
    catch {
      const ta = document.createElement('textarea'); ta.value = text; ta.style.cssText = 'position:fixed;opacity:0';
      shadow.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
    }
    window.__ybaLastReport = text;
    const btn = $('[data-act=copy]');
    btn.classList.add('done'); btn.innerHTML = `${icon('check')}<span>Copied</span>`;
    clearTimeout(copyReport.t);
    copyReport.t = setTimeout(() => { btn.classList.remove('done'); btn.innerHTML = `${icon('copy')}<span>Copy for agent</span>`; }, 1600);
  }

  // ── events ──
  shadow.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act; if (!act) return;
    if (act === 'close') setOpen(false);
    if (act === 'inspect') setInspect(!inspecting);
    if (act === 'copy') copyReport();
    if (act === 'list') { scanPanel.classList.remove('open'); drawer.classList.toggle('open'); }
    if (act === 'scan') { if (scanPanel.classList.contains('open') && scanResult) scanPanel.classList.remove('open'); else { closePop(); startScan(); } }
    if (act === 'pclose') closePop();
    if (act === 'reset' && current) { current.checked.clear(); showing = true; applyRules(current); renderList(); }
    if (act === 'compare' && current) setShowing(!showing);
    if (act === 'approve') approve();
    if (act === 'parent' && current) selectParent();
  });

  function selectParent() {
    const p = current.el.parentElement; if (!p || p === document.documentElement) return;
    const wasApproved = current.approved; closePop(); if (!wasApproved) { /* discarded */ }
    openPop(p);
  }

  const pageTarget = (e) => { const t = e.composedPath()[0]; return t?.nodeType === 1 && !isOurs(t) && t !== document.documentElement && t !== document.body && !(barOpen && e.clientY < BAR_H) ? t : null; };

  document.addEventListener('mousemove', (e) => {
    if (!open || !inspecting || current) return;
    const t = pageTarget(e); if (t === hovered) return;
    hovered = t; drawHL(t, false);
  }, true);

  const swallow = (e) => {
    if (!open || !inspecting || e.composedPath().includes(host)) return;
    e.preventDefault(); e.stopPropagation();
  };
  for (const type of ['mousedown', 'mouseup', 'pointerdown', 'pointerup', 'dblclick', 'submit']) document.addEventListener(type, swallow, true);
  document.addEventListener('click', (e) => {
    if (!open || !inspecting || e.composedPath().includes(host)) return;
    e.preventDefault(); e.stopPropagation();
    const t = pageTarget(e); if (!t) return;
    if (current?.el === t) return;
    openPop(t);
  }, true);

  document.addEventListener('keydown', (e) => {
    if (!open) return;
    if ((e.key === 'h' || e.key === 'H') && current && !e.metaKey && !e.ctrlKey && !e.altKey && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName) && !document.activeElement?.isContentEditable) { e.preventDefault(); e.stopPropagation(); setShowing(!showing); return; }
    if (e.key === 'Escape') { e.preventDefault(); if (scanPanel.classList.contains('open')) scanPanel.classList.remove('open'); else if (drawer.classList.contains('open')) drawer.classList.remove('open'); else if (current) closePop(); else setOpen(false); }
    if (e.key === 'ArrowUp' && (current || hovered) && !/INPUT|TEXTAREA/.test(document.activeElement?.tagName)) {
      e.preventDefault();
      if (current) selectParent(); else if (hovered?.parentElement && hovered.parentElement !== document.body) { hovered = hovered.parentElement; drawHL(hovered, false); }
    }
  }, true);

  let raf = 0;
  const reflow = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { if (current) { drawHL(current.el, true); placePop(); } else if (hovered && inspecting) drawHL(hovered, false); renderMarks(); }); };
  addEventListener('scroll', reflow, true); addEventListener('resize', reflow);

  if (hasChrome) chrome.runtime.onMessage.addListener((m) => { if (m?.type === 'yba:toggle') setOpen(!open); });

  store.get().then((saved) => { approved = saved || []; refreshCount(); if (window.__YBA_DEMO__) setOpen(true); });
  // Small API for pages that embed the demo (same-origin only).
  window.__yba = {
    toggle: () => setOpen(!open),
    report: buildReport,
    approvedCount: () => approved.length,
    // Dry-run every rule (or a subset) over a root: returns what each would change, by popover group.
    audit(rootSel = 'body', ids = RULES.map((r) => r.id)) {
      refreshCovered();
      const root = document.querySelector(rootSel); const out = [];
      for (const [group, gids] of GROUPS) for (const id of gids) {
        if (!ids.includes(id)) continue;
        const els = new Set(), notes = [];
        const add = (el) => { if (el && el.nodeType === 1 && !isOurs(el)) els.add(el); };
        const ctx = { scan: true, rule: id, has: () => false, set: add, hide: add, attr: add, mark: add, css() {}, text: (n) => add(n.parentElement), note: (t) => notes.push(t) };
        try { RULE[id].apply(root, ctx); } catch (e) { notes.push('ERROR ' + e.message); }
        out.push({ group, id, count: els.size, notes, examples: [...els].slice(0, 4).map((el) => selectorFor(el)) });
      }
      return out;
    },
    scan: () => { if (!open) setOpen(true); closePop(); drawer.classList.remove('open'); startScan(); },
    inspect(selector, ruleIds = []) {
      const el = document.querySelector(selector); if (!el) return false;
      if (!open) setOpen(true);
      scanPanel.classList.remove('open'); drawer.classList.remove('open');
      el.scrollIntoView({ block: 'nearest' });
      openPop(el);
      for (const id of ruleIds) current.checked.add(id);
      showing = true; applyRules(current); renderList(); placePop();
      return true;
    },
    approve: () => { if (current) approve(); },
    showList: () => { if (!open) setOpen(true); closePop(); scanPanel.classList.remove('open'); drawer.classList.add('open'); },
  };
})();
