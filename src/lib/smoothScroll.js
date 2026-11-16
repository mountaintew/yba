import Lenis from 'lenis';
import 'lenis/dist/lenis.css';

// Page-wide smooth scrolling.
// Wheel and trackpad scrolling eases to a stop a beat after input ends (lerp 0.08; lower = longer glide).
// Touch keeps native scrolling. Skipped under reduced motion. Anchor links (#how, #rules…) glide too,
// offset so the section lands below the fixed nav. Elements with data-lenis-prevent scroll natively.
export function startSmoothScroll() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return null;
  const navHeight = 72;
  const lenis = new Lenis({ lerp: 0.08, autoRaf: true, anchors: { offset: -(navHeight + 16) } });
  window.lenis = lenis;
  return lenis;
}
