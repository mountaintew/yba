# Chrome Web Store listing: Yba 1.3.0

Paste each section into the matching field in the Chrome Web Store developer dashboard.

## Summary

The store takes the summary from the `description` field in `manifest.json` (132 characters maximum). It has not changed:

> An assistant for deslopping interfaces. Preview fixes on any page and export instructions for your coding agent.

## Description

Yba checks the page you're on for signs that it was made by AI, and for friction that slows visitors down. It previews each fix on the live page and writes a markdown report that your coding agent can apply to your source code.

New in 1.3.0: a Friction group with 5 checks based on the Laws of UX. Yba now flags menus with more than seven choices, buttons and links packed too close to tap, links that don't look like links, form fields the browser can't fill in for you, and required fields that don't say so.

HOW IT WORKS

1. Open Yba with the toolbar icon or press Alt+Shift+D.
2. Read the scan panel. Yba runs 48 checks at the width you're viewing the page. The panel lists the fonts, colours, corner sizes and effects on the page, and every rule that fired.
3. Click a finding, or any element on the page, to preview the fix. Press H to compare before and after.
4. Approve the fixes you want.
5. Click Copy for agent. Paste the report into Claude Code, Cursor or any agent that edits your files.

Page-wide problems come first in the report, so your agent fixes fonts and colours once in your design tokens. Each approved component follows with its CSS selector, its original HTML and the instruction for every rule you checked.

Nothing touches your code. Previews are temporary styles in your browser, and a refresh puts the page back.

WHAT YBA CHECKS

57 rules in nine groups:

• Content: filler badges, repeated labels, vague headlines, AI-sounding phrases, vague button text, long dashes, decoration in place of the real product, template FAQ questions, "Trusted by" logo bars
• Typography: overused AI fonts, random italics, code-style fonts used for looks, headings barely bigger than body text, awkward line breaks, numbers that don't line up, alignment
• Layout: sizes with no pattern, nothing standing out, lines where space would do, boxes inside boxes, side-by-side text that doesn't line up, rounded corners that don't fit
• Colour and detail: competing main buttons, rainbow gradients, pure black and white, faint text, mismatched icons, glows and heavy shadows
• Accessibility: buttons too small to tap, images with no description, icon buttons with no name, images that shift the page, links that go nowhere, clickable boxes a keyboard can't reach, missing hand cursors, fields with no label, skipped heading levels
• Responsive: pictures too big on phones, sideways scrolling, text too small to read
• Banned patterns: side stripes on cards, heavy borders, rainbow text, decorative big-number stats, rows of identical cards, background grids, arrows on every button, decorative status dots, fake terminal windows
• Behaviour: areas that sit blank while loading, looping animation, a main image that loads late
• Friction: long menus, cramped tap targets, links that blend into text, forms the browser can't fill in, unmarked required fields

Some rules need new words or new pictures. For those, Yba outlines the spot in red with a short note and leaves the rewrite to your agent. The rest preview live.

The rules read computed styles, so expect the odd false positive. That is why every fix is a preview you approve first.

PRIVACY

Yba makes no network requests and has no account. It runs only when you open it. The components you approve stay in your browser until you remove them. Yba reads field labels to check forms, but never what anyone typed.

Yba also runs in Edge, Arc, Brave, Opera and other Chromium browsers.

## Privacy practices

These answers are unchanged from 1.2.0. Check them against the dashboard before you submit.

**Single purpose:** Yba checks the current page for design, copy and usability problems, previews fixes on that page, and copies a report of the approved fixes to the clipboard.

**activeTab:** Yba reads the current tab only after you click its toolbar icon or press its keyboard shortcut.

**scripting:** Yba adds its panel and its fix previews to the current tab.

**storage:** Yba saves the components you approve on your device, so they come back after a refresh.

**Remote code:** No. All code ships inside the package.

**Data use:** Yba collects no user data.

**Privacy policy link:** https://yba.lesterantonio.dev/privacy/
