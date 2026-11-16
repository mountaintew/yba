// One icon set: 20px grid, 2px stroke, round caps.
const base = { className: 'i', viewBox: '0 0 20 20', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };

export function DownloadIcon() {
  return <svg {...base}><path d="M10 3v10M5.5 8.5 10 13l4.5-4.5M4 16.5h12" /></svg>;
}

export function ChevronIcon() {
  return <svg {...base} className="i chev"><path d="M5 7.5 10 12.5 15 7.5" /></svg>;
}
