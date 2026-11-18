import { useEffect, useState } from 'react';
import DownloadButton from './DownloadButton.jsx';

// Floats over the hero, then turns solid once the hero scrolls away so Add to Chrome stays in reach.
export default function Nav() {
  const [solid, setSolid] = useState(false);

  useEffect(() => {
    const hero = document.querySelector('.hero');
    if (!hero) return undefined;
    const observer = new IntersectionObserver(([entry]) => setSolid(!entry.isIntersecting), { rootMargin: '-72px 0px 0px 0px' });
    observer.observe(hero);
    return () => observer.disconnect();
  }, []);

  return (
    <header className={solid ? 'nav solid' : 'nav'}>
      <div className="wrap">
        <a className="brand" href="#top">
          <img src={`${import.meta.env.BASE_URL}assets/avatar.png`} alt="" width="36" height="36" />
          Yba
        </a>
        <nav aria-label="Sections">
          <a href="#how">How it works</a>
          <a href="#rules">Rules</a>
          <a href="#questions">Questions</a>
        </nav>
        <DownloadButton placement="nav" small>Add to Chrome</DownloadButton>
      </div>
    </header>
  );
}
