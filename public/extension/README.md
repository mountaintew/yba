# Yba

An assistant for deslopping interfaces.

A Chrome extension that checks the page you're on for signs of AI-made design and copy. It previews each fix on the live page and writes a markdown report your coding agent can apply to the real source. It also runs in Edge, Arc, Brave, Opera and other Chromium browsers.

## Install

1. Open `chrome://extensions` and turn on Developer mode.
2. Click Load unpacked and pick this `yba` folder.
3. On any page, click the Yba toolbar icon or press Alt+Shift+D.

## Use

Opening Yba slides a bar down from the top and scans the whole page. The scan panel lists the fonts and their share of the page (AI-default fonts are marked), how many colours, radii, gradients and shadows the page uses, and every rule that fired, sorted by how many elements it hit. Hover an item to highlight it. Click it to scroll there and open that component with the rule already checked. The **Scan · N** button reopens the panel or runs the scan again.

The scan measures the page at the width you're viewing it. Resize to a phone width (375px) and scan again to catch mobile problems. Anything hidden behind the Yba bar, such as a fixed header, is left out while the bar is open.

With Inspect on, hover to highlight a component and press ↑ to move to its parent. Click to open the popover, which lists all 40 rules in eight groups. Check a rule, a whole group or All rules to apply the fixes to the page; a note under each rule says what changed. Flip Show changes, or press H, to compare against the original without losing your checks.

Approve adds the component to the report. Closing without approving puts the page back. Copy for agent puts the report on your clipboard: page-wide findings first, then each approved component with its selector, its HTML from before the preview, and what changed. The counter in the bar opens the list of approved components, where you can remove them.

Approved components are saved per page in your browser, and their previews come back when you reopen the bar after a refresh.

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

Rules marked \* need new words or new assets, so Yba outlines the spot in red with a short note and leaves the rewrite to your agent. The rest preview live, and unchecking a rule or closing the popover restores the page exactly.

The rules read computed styles, so they are heuristics. Treat the preview as a direction and the report as the spec.

## Privacy

The extension makes zero network requests and has no account. It asks for three permissions: the active tab, script injection to show its panel, and local storage for the components you approve.
