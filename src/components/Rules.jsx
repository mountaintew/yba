import { rules } from '../content.js';
import ScrollWords from './ScrollWords.jsx';
import { FlagIcon } from './Icons.jsx';

// Flag icon with a tooltip on hover or keyboard focus; marks rules the extension flags for the agent.
function Flag() {
  return <span className="flag" tabIndex={0} role="img" aria-label={rules.flagTip} data-tip={rules.flagTip}><FlagIcon /></span>;
}

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
                {items.map(([label, agent]) => (
                  <li key={label}> {label} {agent && <Flag />}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
