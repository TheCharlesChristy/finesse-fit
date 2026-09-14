import { useMemo } from 'react';
import { Dumbbell, MapPinned, Pencil, Share2, Trash2 } from 'lucide-react';
import { computeSplits, distanceUnitLabel, fmtClock, fmtDistance, fmtPace, paceOf, splitLength, trackLatLngs } from '../geo.js';
import { activityLabel, fmtSpan, intensityLabel } from '../plans.js';
import { exerciseName, fmtDate, fmtWeight, summariseSets } from '../utils.js';
import RouteMap from './RouteMap.jsx';
import { CardTitle, Modal } from './ui.jsx';

export default function ActivityModal({ workout, track, exercises, units, onClose, onEditSets, onDelete, onExportGpx, onSaveRoute }) {
  const segments = useMemo(() => track?.segments ?? [], [track]);
  const lines = useMemo(() => trackLatLngs(segments), [segments]);
  const splits = useMemo(() => computeSplits(segments, splitLength(units)), [segments, units]);
  const cardio = workout.cardio ?? [];
  const distance = workout.distance ?? cardio.reduce((sum, item) => sum + (item.meters ?? 0), 0);
  const moving = workout.movingSeconds ?? cardio.reduce((sum, item) => sum + (item.seconds ?? 0), 0);
  const pace = paceOf(moving, distance);
  const groups = summariseSets(workout.sets ?? []);
  const fastest = splits.filter((split) => !split.partial).reduce((best, split) => Math.min(best, split.seconds / split.meters), Infinity);
  const slowest = splits.reduce((worst, split) => Math.max(worst, split.seconds / Math.max(split.meters, 1)), 0);
  const title = workout.name || (cardio.length ? activityLabel(cardio[0].activity) : 'Workout');

  return (
    <Modal
      title={title}
      subtitle={fmtDate(workout.startedAt ?? workout.date, workout.startedAt ? 'EEEE d MMMM · HH:mm' : 'EEEE d MMMM')}
      size="lg"
      onClose={onClose}
      footer={(
        <>
          <button className="btn-danger" type="button" onClick={() => onDelete(workout.id)}><Trash2 size={18} aria-hidden="true" /> Delete</button>
          <span className="spacer" />
          {lines.length > 0 && <button className="btn-secondary" type="button" onClick={() => onSaveRoute(workout, track)}><MapPinned size={17} aria-hidden="true" /> Save as route</button>}
          {lines.length > 0 && <button className="btn-secondary" type="button" onClick={() => onExportGpx(workout, track)}><Share2 size={17} aria-hidden="true" /> GPX</button>}
          {(workout.sets?.length ?? 0) > 0 && <button className="btn-primary" type="button" onClick={() => onEditSets(workout)}><Pencil size={17} aria-hidden="true" /> Edit sets</button>}
        </>
      )}
    >
      <div className="activity-stats">
        {distance > 0 && <div><span className="eyebrow">Distance</span><span className="metric">{fmtDistance(distance, units)}</span></div>}
        {workout.durationSeconds > 0 && <div><span className="eyebrow">Total time</span><span className="metric">{fmtClock(workout.durationSeconds)}</span></div>}
        {distance > 0 && moving > 0 && <div><span className="eyebrow">Avg pace</span><span className="metric">{fmtPace(pace, units, { suffix: false })}<small>/{distanceUnitLabel(units)}</small></span></div>}
        {workout.elevationGain != null && workout.elevationGain > 0 && <div><span className="eyebrow">Climb</span><span className="metric">{workout.elevationGain}<small>m</small></span></div>}
        {(workout.sets?.length ?? 0) > 0 && <div><span className="eyebrow">Sets</span><span className="metric">{workout.sets.length}</span></div>}
      </div>

      {lines.length > 0 && <RouteMap className="activity-map" track={lines} fitKey={workout.id} label={`Map of ${title}`} />}

      {splits.length > 1 && (
        <section className="card panel stack">
          <CardTitle>Splits</CardTitle>
          <div className="splits" role="table" aria-label="Splits">
            {splits.map((split) => {
              const secondsPerMeter = split.seconds / Math.max(split.meters, 1);
              const width = slowest > 0 ? Math.max(12, Math.round((fastest === Infinity ? 1 : fastest / secondsPerMeter) * 100)) : 0;
              return (
                <div key={split.index} className="split-row" role="row">
                  <span role="cell" className="muted">{split.partial ? fmtDistance(split.meters, units) : `${split.index} ${distanceUnitLabel(units)}`}</span>
                  <span role="cell" className="split-bar"><i style={{ '--value': `${Math.min(100, width)}%` }} className={secondsPerMeter === fastest ? 'best' : ''} /></span>
                  <span role="cell" className="nowrap font-mono">{fmtPace(secondsPerMeter, units, { suffix: false })}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {cardio.length > 1 && (
        <section className="card panel stack">
          <CardTitle>Segments</CardTitle>
          <div className="list">
            {cardio.map((item, index) => (
              <div key={index} className={`split detail-row segment-row ${item.intensity === 'hard' ? 'hard' : ''}`}>
                <span className="truncate">{item.label || activityLabel(item.activity)} <span className="muted">{item.intensity && item.label !== intensityLabel(item.intensity) ? `· ${intensityLabel(item.intensity)}` : ''}</span></span>
                <span className="nowrap">
                  {item.meters > 0 && `${fmtDistance(item.meters, units)} · `}{fmtSpan(item.seconds)}
                  {item.meters > 0 && item.seconds > 0 && <span className="muted"> · {fmtPace(paceOf(item.seconds, item.meters), units)}</span>}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {groups.length > 0 && (
        <section className="card panel stack">
          <CardTitle icon={Dumbbell}>Exercises</CardTitle>
          <div className="list">
            {groups.map((group) => (
              <div key={String(group.exerciseId)} className="split detail-row">
                <span className="truncate">{exerciseName(exercises, group.exerciseId)} <span className="muted">× {group.sets}</span></span>
                <span className="nowrap muted">{group.best.seconds ? fmtSpan(group.best.seconds) : `${group.best.weight ? fmtWeight(group.best.weight, units) : 'BW'} × ${group.best.reps}`}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </Modal>
  );
}
