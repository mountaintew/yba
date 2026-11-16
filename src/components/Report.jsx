import { report } from '../content.js';
import ScrollWords from './ScrollWords.jsx';

// An excerpt of a real report from the demo page, with headings and keys tinted.
const H = ({ children }) => <span className="h">{children}</span>;
const K = ({ children }) => <span className="k">{children}</span>;

export default function Report() {
  return (
    <section className="report" aria-labelledby="report-title">
      <div className="wrap">
        <div>
          <h2 id="report-title"><ScrollWords>{report.title}</ScrollWords></h2>
          <p><ScrollWords>{report.body}</ScrollWords></p>
        </div>
        <div className="pre-wrap">
          <pre id="report-pre" tabIndex={0} aria-label="Example report" data-lenis-prevent>
            <H>## Page-wide scan</H>{'\n'}
            <K>**Fonts:**</K>{' Inter 94% (AI default), JetBrains Mono 6%\n\n'}
            {'- '}<K>**No side-stripe borders**</K>{` (1 element):
  Remove side-stripe borders thicker than 1px used as
  a coloured accent. Rewrite with a full 1px border,
  a background tint, or nothing.
  - Found: 4px left stripe on "Built for modern teams"
  - Examples: \`#callout\`

`}
            <H>### 1. `#hero`</H>{'\n- '}
            <K>**No gradient text:**</K>{` Replace gradient text with
  a single solid colour. Use weight or size for emphasis.
  - Observed: Solid text on "Unlock the power of…"`}
          </pre>
        </div>
      </div>
    </section>
  );
}
