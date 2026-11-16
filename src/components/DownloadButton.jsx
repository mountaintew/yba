import { DOWNLOAD } from '../content.js';
import { DownloadIcon } from './Icons.jsx';

// The page's one primary action; the same button appears in the nav, hero and closing section.
export default function DownloadButton({ small = false, children = 'Download Yba for Chrome' }) {
  return (
    <a className={small ? 'dl small' : 'dl'} href={DOWNLOAD.href} download={DOWNLOAD.filename} type="application/zip">
      <DownloadIcon />
      {children}
    </a>
  );
}
