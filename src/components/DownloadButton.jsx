import { storeLink } from '../content.js';
import { DownloadIcon } from './Icons.jsx';

// The page's one primary action: the Chrome Web Store listing. It appears in the nav, hero and closing section,
// and `placement` goes into the link's utm_content so each one is counted separately.
export default function DownloadButton({ placement, small = false, children = 'Add Yba to Chrome' }) {
  return (
    <a className={small ? 'dl small' : 'dl'} href={storeLink(placement)}>
      <DownloadIcon />
      {children}
    </a>
  );
}
