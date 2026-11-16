import { rules } from '../content.js';
import ScrollWords from './ScrollWords.jsx';

export default function Rules() {
  return (
    <section id="rules" aria-labelledby="rules-title">
      <div className="wrap">
        <div className="rules-head">
          <h2 id="rules-title"><ScrollWords>{rules.title}</ScrollWords></h2>
          <p><ScrollWords>{rules.intro}</ScrollWords></p>
        </div>
        <div className="groups">
          {rules.groups.map(([group, items]) => (
            <div className="group" key={group}>
              <h3>{group}</h3>
              <ul>
                {items.map(([label]) => (
                  <li key={label}>{label}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
