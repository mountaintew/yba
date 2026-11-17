import { closing } from '../content.js';
import ScrollWords from './ScrollWords.jsx';
import DownloadButton from './DownloadButton.jsx';

export default function Closing() {
  return (
    <section className="closing" aria-labelledby="closing-title">
      <div className="wrap">
        <h2 id="closing-title"><ScrollWords>{closing.title}</ScrollWords></h2>
        <p>{closing.body}</p>
        <DownloadButton />
        <p className="version">{closing.version} · <a href={`${import.meta.env.BASE_URL}privacy/`}>Privacy policy</a></p>
      </div>
    </section>
  );
}
