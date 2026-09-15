import { Check } from 'lucide-react';
import { BODY_FAT_REFERENCES, VERY_LOW_BODY_FAT } from '../data/bodyFatReferences.js';
import { Segmented } from './ui.jsx';

// Text-only reference rows (percentage, a plain-language label, and a short
// description) for someone picking a target body fat who isn't sure what a
// given number looks like. There's no illustration here on purpose — see
// bodyFatReferences.js for why.
export default function BodyFatReference({ sex, onSexChange, value, onPick }) {
  const references = BODY_FAT_REFERENCES[sex];
  return (
    <div className="stack" style={{ gap: 10 }}>
      <Segmented
        label="Show examples for"
        hideLabel
        value={sex}
        options={[{ value: 'male', label: 'Men' }, { value: 'female', label: 'Women' }]}
        onChange={onSexChange}
      />
      <div className="list">
        {references.map((reference) => {
          const selected = value === reference.bodyFat;
          return (
            <button
              key={reference.bodyFat}
              type="button"
              className={`list-row bodyfat-row ${selected ? 'selected' : ''}`}
              aria-pressed={selected}
              onClick={() => onPick(selected ? null : reference.bodyFat)}
            >
              <strong className="bodyfat-value">{reference.bodyFat}%</strong>
              <span className="list-main">
                <span className="list-title">{reference.label}</span>
                <span className="list-sub">{reference.description}</span>
              </span>
              {selected && <Check size={18} className="bodyfat-check" />}
            </button>
          );
        })}
      </div>
      <span className="muted form-note">
        Tap one to use it as your target, or tap it again to clear. These are rough guides: the same percentage looks different on different builds, and under about {VERY_LOW_BODY_FAT[sex]}% is hard to sustain.
      </span>
    </div>
  );
}
