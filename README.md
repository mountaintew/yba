<img src="public/assets/avatar.png" alt="" width="72" height="72">

# Yba

An assistant for deslopping interfaces.

Yba is a Chrome extension that finds what makes a page look AI-made. It checks the page you're on for 57 signs of AI-generated design and copy, and of friction that slows visitors down, previews each fix on the live page, and writes a markdown report your coding agent can apply to the real source. It also runs in Edge, Arc, Brave, Opera and other Chromium browsers.

## How it works

1. Open Yba with the toolbar icon or Alt+Shift+D and it scans the whole page, running 48 checks at the width you're viewing it. A panel lists the fonts the page uses (AI-default ones are marked), its colours, radii and effects, and every rule that fired, sorted by how many elements it hit.
2. Click a finding, or any element on the page, to preview the fix. The rule applies right there as a temporary style, and pressing H flips between before and after. Nothing touches your code, and a refresh puts the page back.
3. Approve the fixes you want, then Copy for agent puts a report on your clipboard. Page-wide problems come first, so fonts and colours get fixed once in your tokens. Each approved component follows with its CSS selector, its HTML from before the preview, and the instruction for every rule you checked. Paste it into Claude Code, Cursor or any agent that edits your files.

## The rules

| Group | Rules |
|---|---|
| Content | remove filler badges, remove repeated labels, make headlines specific\*, rewrite AI-sounding text\*, make button text specific\*, remove long dashes, show the real product\*, answer real questions in the FAQ\*, back up the logo bar\* |
| Typography | replace overused AI fonts, remove random italics, use code-style font only for code, make headings stand out, fix awkward line breaks, line up numbers, fine-tune alignment |
| Layout | use consistent sizes, make the main thing bigger, use space instead of lines, remove boxes inside boxes, line up side-by-side text, match rounded corners |
| Colour & detail | make one main button stand out, use one brand colour, soften pure black and white, make faint text readable, make icons match, remove glows and heavy shadows |
| Accessibility | make buttons easy to tap, describe images\*, name icon-only buttons\*, stop images shifting the page\*, fix links that go nowhere\*, use real buttons\*, show a hand cursor on controls, label every form field\*, keep heading levels in order\* |
| Responsive | shrink big pictures on phones\*, stop sideways scrolling, make small text bigger |
| Banned patterns | remove side stripes, thin out heavy borders, remove rainbow text, rethink big-number stats\*, vary repeated cards\*, remove background grids, drop arrows from buttons, remove decorative status dots, drop fake terminal windows\* |
| Behaviour | show loading progress\*, use helpful animation, load the main image first\* |
| Friction | trim long menus\*, space out tap targets\*, make links look like links, help browsers fill in forms\*, mark required fields\* |

Rules marked \* need new words or new assets, so Yba outlines the spot in red with a short note and leaves the rewrite to your agent. The rest preview live.

The design rules follow [impeccable](https://impeccable.style)'s design laws. The font list comes from published notes on AI-default typography: Inter, Geist, Space Grotesk and friends, plus the generic 2010s defaults. The copy rules target the phrasing patterns common in AI-written copy, so Yba catches lines like "it's not X, it's Y" and "unlock the power of". Accessibility checks follow WCAG 2.2. The friction checks follow the [Laws of UX](https://lawsofux.com): Hick's law for long menus, Fitts's law for cramped tap targets, Jakob's law for links that don't look like links, and Tesler's law for forms the browser could fill in.

The rules read computed styles, which makes them heuristics. Expect the odd false positive. That's why every fix is a preview you approve first, and the report goes to your agent as a spec to apply.

## Install

Add Yba from the [Chrome Web Store](https://chromewebstore.google.com/detail/Yba/nnojglncnpiibfhbajbepkdlpdllbeij?utm_source=github&utm_medium=readme&utm_campaign=repo). It also runs in Edge, Arc, Brave, Opera and other Chromium browsers.

To run the version in this repo, open `chrome://extensions`, turn on Developer mode, click Load unpacked and pick the `public/extension` folder.

## Privacy

The extension makes zero network requests and has no account. It asks for three permissions: the active tab, script injection to show its panel, and local storage for the components you approve. Approved components stay in your browser until you remove them.


## Support Yba

Support Yba on [App Builders PH](https://appbuildersph.com/apps/yba).
