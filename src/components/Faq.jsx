import { useEffect, useRef, useState } from 'react';
import { faq } from '../content.js';
import { ChevronIcon } from './Icons.jsx';
import ScrollWords from './ScrollWords.jsx';

// Native details/summary accordion, every answer open by default. The capybara beside it follows
// scrolling: whichever question crosses the middle of the viewport sets the picture.
export default function Faq() {
  const [active, setActive] = useState(0);
  const itemRefs = useRef([]);
  const artRef = useRef(null);

  useEffect(() => {
    // A zero-height band at the vertical centre of the viewport; the question crossing it is "current".
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(Number(entry.target.dataset.index));
        }
      },
      { rootMargin: '-50% 0px -50% 0px', threshold: 0 },
    );
    itemRefs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    // The sticky picture stops following once the list ends. Leave enough room below the last question
    // for its centre to reach the picture's centre: half the picture minus half the question.
    const art = artRef.current;
    const last = itemRefs.current.at(-1);
    const list = last?.parentElement;
    if (!art || !list) return undefined;
    const measure = () => list.style.setProperty('--faq-tail', `${Math.max(0, (art.offsetHeight - last.offsetHeight) / 2)}px`);
    const ro = new ResizeObserver(measure);
    ro.observe(art);
    ro.observe(last);
    return () => ro.disconnect();
  }, []);

  return (
    <section id="questions" className="faq" aria-labelledby="faq-title">
      <div className="wrap">
        <div className="faq-art" ref={artRef}>
          {faq.items.map((item, i) => (
            <img
              key={item.art}
              src={item.art}
              alt={i === active ? item.alt : ''}
              aria-hidden={i !== active}
              className={i === active ? 'is-active' : undefined}
              width="300"
              height="300"
              decoding="async"
            />
          ))}
        </div>
        <div>
          <h2 id="faq-title"><ScrollWords>{faq.title}</ScrollWords></h2>
          <div className="qa-list">
            {faq.items.map((item, i) => (
              <details className="qa" key={item.q} open data-index={i} ref={(el) => { itemRefs.current[i] = el; }}>
                <summary><span>{item.q}</span><ChevronIcon /></summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
