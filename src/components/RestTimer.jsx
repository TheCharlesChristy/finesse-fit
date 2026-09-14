import { Timer, X } from 'lucide-react';
import { fmtDuration } from '../utils.js';

const REST_PRESETS = [60, 90, 120, 180];

export default function RestTimerBar({ timer, seconds, onSecondsChange }) {
  if (timer.running) {
    return (
      <div className="rest-timer running" role="timer" aria-live="off">
        <Timer size={18} aria-hidden="true" />
        <strong className="rest-time">{fmtDuration(timer.remaining)}</strong>
        <span className="muted">rest</span>
        <div className="row" style={{ marginLeft: 'auto', gap: 6, flexWrap: 'nowrap' }}>
          <button type="button" className="chip" onClick={() => timer.add(30)}>+30s</button>
          <button type="button" className="btn-icon" aria-label="Stop rest timer" onClick={timer.stop}><X size={16} /></button>
        </div>
      </div>
    );
  }
  return (
    <div className={`rest-timer ${timer.finished ? 'finished' : ''}`}>
      <Timer size={18} aria-hidden="true" />
      <span className={timer.finished ? '' : 'muted'} role={timer.finished ? 'status' : undefined}>{timer.finished ? 'Rest over — next set!' : 'Rest'}</span>
      <div className="chip-row" style={{ marginLeft: 'auto' }} role="radiogroup" aria-label="Rest length">
        {REST_PRESETS.map((preset) => (
          <button key={preset} type="button" role="radio" aria-checked={seconds === preset} className={`chip ${seconds === preset ? 'active' : ''}`} onClick={() => { onSecondsChange(preset); timer.start(preset); }}>
            {fmtDuration(preset)}
          </button>
        ))}
      </div>
    </div>
  );
}
