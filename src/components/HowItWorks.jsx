import { useState } from 'react';
import { how, DEMO_URL } from '../content.js';
import ScrollWords from './ScrollWords.jsx';

export default function HowItWorks() {
  // Loading state for the live demo: the frame fades in once the extension page has loaded.
  const [loaded, setLoaded] = useState(false);

  return (
    <section id="how" aria-labelledby="how-title">
      <div className="wrap">
        <div className="how-head">
          <h2 id="how-title"><ScrollWords>{how.title}</ScrollWords></h2>
          <p><ScrollWords>{how.intro}</ScrollWords></p>
        </div>
        <ol className="steps">
          <li>
            <h3><ScrollWords>Scan the page</ScrollWords></h3>
            <p>Open Yba and it runs 30 checks over the whole page, at the width you&apos;re viewing it. Findings are sorted by how often they appear, so the font that covers 25 elements sits above the one stray em dash.</p>
          </li>
          <li>
            <h3><ScrollWords>Preview a fix</ScrollWords></h3>
            <p>Click a finding or any element. The rule applies right there, and <kbd>H</kbd> flips between before and after.</p>
          </li>
          <li>
            <h3><ScrollWords>Send it to your agent</ScrollWords></h3>
            <p>Approve the fixes you want. <b>Copy for agent</b> gives you each element&apos;s selector, its HTML from before the preview, and what changed.</p>
          </li>
        </ol>
        <div className="demo" aria-busy={!loaded}>
          <iframe src={DEMO_URL} title="Yba running on a deliberately sloppy demo page" loading="lazy" onLoad={() => setLoaded(true)} />
          <div className="demo-fallback">
            <p><ScrollWords>The demo runs the real extension, which is built for desktop screens.</ScrollWords></p>
            <a className="text-link" href={DEMO_URL} target="_blank" rel="noopener">Open the demo in a new tab</a>
          </div>
        </div>
      </div>
    </section>
  );
}
