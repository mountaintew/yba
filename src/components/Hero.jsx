import { hero } from '../content.js';
import DownloadButton from './DownloadButton.jsx';
import ScrollWords from './ScrollWords.jsx';

// Keep hyphenated compounds like "AI-made" on one line instead of breaking at the hyphen.
const keepTogether = (text) => text.split(/(\b[\w]+-[\w]+\b)/).map((part, i) => (i % 2 ? <span className="nobr" key={i}>{part}</span> : part));

export default function Hero() {
  return (
    <section className="hero" id="top" aria-labelledby="hero-title">
      <div className="wrap">
        <div className="hero-copy">
          <h1 id="hero-title"><ScrollWords>{hero.title}</ScrollWords></h1>
          <p className="lead"><ScrollWords>{keepTogether(hero.lead)}</ScrollWords></p>
          <div className="actions">
            <DownloadButton />
          </div>
        </div>
      </div>
    </section>
  );
}
