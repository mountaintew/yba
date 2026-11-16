import { closing } from '../content.js';
import ScrollWords from './ScrollWords.jsx';
import DownloadButton from './DownloadButton.jsx';

export default function Closing() {
  return (
    <section className="closing" aria-labelledby="closing-title">
      <div className="wrap">
        <h2 id="closing-title"><ScrollWords>{closing.title}</ScrollWords></h2>
        <p><ScrollWords>{closing.body}</ScrollWords></p>
        <DownloadButton />
        <p className="version">{closing.version}</p>
      </div>
    </section>
  );
}
