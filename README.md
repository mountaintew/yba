<img src="public/assets/avatar.png" alt="" width="72" height="72">

# Yba

An assistant for desloping interfaces.

Yba is a Chrome extension that finds what makes a page look AI-made. It checks the page you're on for 40 signs of AI-generated design and copy, previews each fix on the live page, and writes a markdown report your coding agent can apply to the real source. It also runs in Edge, Arc, Brave, Opera and other Chromium browsers.

## How it works

1. Open Yba with the toolbar icon or Alt+Shift+D and it scans the whole page, running 30 checks at the width you're viewing it. A panel lists the fonts the page uses (AI-default ones are marked), its colours, radii and effects, and every rule that fired, sorted by how many elements it hit.
2. Click a finding, or any element on the page, to preview the fix. The rule applies right there as a temporary style, and pressing H flips between before and after. Nothing touches your code, and a refresh puts the page back.
3. Approve the fixes you want, then Copy for agent puts a report on your clipboard. Page-wide problems come first, so fonts and colours get fixed once in your tokens. Each approved component follows with its CSS selector, its HTML from before the preview, and the instruction for every rule you checked. Paste it into Claude Code, Cursor or any agent that edits your files.

## The rules

| Group | Rules |
|---|---|
| Content | remove filler badges, remove repeated labels, make headlines specific\*, rewrite AI-sounding text\*, make button text specific\*, remove long dashes, show the real product\* |
| Typography | replace overused AI fonts, remove random italics, use code-style font only for code, make headings stand out, fix awkward line breaks, line up numbers, fine-tune alignment |
| Layout | use consistent sizes, make the main thing bigger, use space instead of lines, remove boxes inside boxes, line up side-by-side text, match rounded corners |
| Colour & detail | make one main button stand out, use one brand colour, soften pure black and white, make faint text readable, make icons match, remove glows and heavy shadows |
| Accessibility | make buttons easy to tap, describe images\*, name icon-only buttons\*, stop images shifting the page\* |
| Responsive | shrink big pictures on phones\*, stop sideways scrolling, make small text bigger |
| Banned patterns | remove side stripes, thin out heavy borders, remove rainbow text, rethink big-number stats\*, vary repeated cards\* |
| Behaviour | show loading progress\*, use helpful animation |

Rules marked \* need new words or new assets, so Yba outlines the spot in red with a short note and leaves the rewrite to your agent. The rest preview live.

The design rules follow [impeccable](https://impeccable.style)'s design laws. The font list comes from published notes on AI-default typography: Inter, Geist, Space Grotesk and friends, plus the generic 2010s defaults. The copy rules follow Wikipedia's guide to [signs of AI writing](https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing), so Yba catches lines like "it's not X, it's Y" and "unlock the power of". Accessibility checks follow WCAG 2.2.

The rules read computed styles, which makes them heuristics. Expect the odd false positive. That's why every fix is a preview you approve first, and the report goes to your agent as a spec to apply.

## Install

Yba isn't in the Chrome Web Store yet, so it installs as an unpacked extension:

1. Download [`yba-extension.zip`](public/yba-extension.zip) and unzip it.
2. Open `chrome://extensions` and turn on Developer mode.
3. Click Load unpacked and pick the `yba` folder.

## Privacy

The extension makes zero network requests and has no account. It asks for three permissions: the active tab, script injection to show its panel, and local storage for the components you approve. Approved components stay in your browser until you remove them.


## Support Yba

Support Yba on [App Builders PH](https://appbuildersph.com/apps/yba).
