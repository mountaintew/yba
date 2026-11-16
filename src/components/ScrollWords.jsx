import { animate, motion, useMotionValue, useReducedMotion, useScroll, useTransform } from 'motion/react';
import { Children, cloneElement, isValidElement, useLayoutEffect, useRef } from 'react';

// ScrollWords. Splits its children into words; each word fades in from hidden,
// rises 0.4em and un-blurs as the text scrolls through the window below, one after another, so it reads
// as a wave. Scrolling back up reverses it. Text already on screen at load plays the same stagger by time.
// Screen readers get the original text once (sr-only); the split copy is aria-hidden.
// Under reduced motion it renders the children unchanged.

// The reveal starts when the text's top reaches 90% down the viewport and finishes by 45%.
const OFFSET = ['start 0.9', 'start 0.45'];
const WINDOW = 0.2; // each word's share of the scroll window; overlapping so it reads as a wave
const FROM_Y = 0.4; // em, so the rise scales with the font size
const FROM_BLUR = 4; // px

const MotionSpan = motion.span;

// ~30ms between words, clamped to 0.5–0.9s total, for text that can't be scrolled through its reveal.
const introDuration = (words) => Math.min(0.9, Math.max(0.5, (0.03 * Math.max(0, words - 1)) / (1 - WINDOW)));

const progressAt = (top, vh) => Math.min(1, Math.max(0, (0.9 * vh - top) / (0.9 * vh - 0.45 * vh)));

// Per-word progress 0 → 1 with a cubic ease-out: fast at first, settling gently.
const wordProgress = (p, [start, end]) => {
  const t = Math.min(1, Math.max(0, (p - start) / (end - start)));
  return 1 - (1 - t) ** 3;
};

function Word({ progress, range, children }) {
  const opacity = useTransform(progress, (p) => wordProgress(p, range));
  const transform = useTransform(progress, (p) => {
    const t = wordProgress(p, range);
    return t === 1 ? 'none' : `translateY(${FROM_Y * (1 - t)}em)`;
  });
  // Blur only while in flight, so settled and hidden words carry no filter.
  const filter = useTransform(progress, (p) => {
    const t = wordProgress(p, range);
    return t === 0 || t === 1 ? 'none' : `blur(${FROM_BLUR * (1 - t)}px)`;
  });
  return <MotionSpan className="sw-word" style={{ opacity, transform, filter }}>{children}</MotionSpan>;
}

function countWords(node) {
  let n = 0;
  Children.forEach(node, (child) => {
    if (typeof child === 'string' || typeof child === 'number') n += String(child).split(/\s+/).filter(Boolean).length;
    else if (isValidElement(child)) n += countWords(child.props.children);
  });
  return n;
}

export default function ScrollWords({ children }) {
  const reduce = useReducedMotion();
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: OFFSET });
  const driver = useMotionValue(0);
  const total = Math.max(1, countWords(children));

  useLayoutEffect(() => {
    const el = ref.current;
    if (reduce || !el) return undefined;
    const vh = window.innerHeight;
    const rect = el.getBoundingClientRect();
    const p0 = progressAt(rect.top, vh);
    if (rect.top < vh && rect.bottom > 0 && p0 < 1) {
      driver.set(p0);
      const controls = animate(driver, 1, { duration: introDuration(total) * (1 - p0), ease: 'linear' });
      return () => controls.stop();
    }
    driver.set(scrollYProgress.get() || p0);
    return scrollYProgress.on('change', (v) => driver.set(v));
  }, [reduce, total, driver, scrollYProgress]);

  // Pre-rendered HTML (no window) gets the plain text, so crawlers and link previews read each heading once.
  if (reduce || typeof window === 'undefined') return <>{children}</>;

  const step = total > 1 ? (1 - WINDOW) / (total - 1) : 0;
  let index = 0;
  const split = (node) => Children.map(node, (child) => {
    if (typeof child === 'string' || typeof child === 'number') {
      // Whitespace stays plain text so lines still wrap between words.
      return String(child).split(/(\s+)/).map((part, i) => {
        if (!part || /^\s+$/.test(part)) return part;
        const start = index++ * step;
        return <Word key={i} progress={driver} range={[start, start + WINDOW]}>{part}</Word>;
      });
    }
    if (isValidElement(child)) return cloneElement(child, undefined, split(child.props.children));
    return child;
  });

  return (
    <>
      <span className="sr-only">{children}</span>
      <span ref={ref} aria-hidden="true" className="sw-text">{split(children)}</span>
    </>
  );
}
