import { fmtCalories, fmtCompact, fmtWeight } from '../utils.js';

function Stat({ value, label, tone }) {
  return (
    <div className="review-stat">
      <div className={`review-value ${tone ?? ''}`}>{value}</div>
      <span className="muted">{label}</span>
    </div>
  );
}

export default function WeekReview({ review, units }) {
  const { volumeChange, weightChange } = review;
  return (
    <div className="review-grid">
      <Stat value={`${review.daysLogged}/7`} label="days logged" />
      <Stat value={`${review.caloriesOnTarget}/7`} label="calories on target" tone={review.caloriesOnTarget >= 5 ? 'good' : undefined} />
      <Stat value={`${review.proteinOnTarget}/7`} label="protein on target" tone={review.proteinOnTarget >= 5 ? 'good' : undefined} />
      <Stat value={review.avgCalories ? fmtCalories(review.avgCalories) : '–'} label="avg on logged days" />
      <Stat value={review.sessions} label={review.sessions === 1 ? 'session' : 'sessions'} />
      <Stat
        value={fmtCompact(review.volume)}
        label={volumeChange == null ? 'volume' : `volume · ${volumeChange >= 0 ? '+' : ''}${volumeChange}% vs prior`}
        tone={volumeChange == null ? undefined : volumeChange >= 0 ? 'good' : 'warn'}
      />
      <Stat value={review.prs} label={review.prs === 1 ? 'PR' : 'PRs'} tone={review.prs ? 'good' : undefined} />
      <Stat
        value={weightChange == null ? '–' : `${weightChange > 0 ? '+' : weightChange < 0 ? '−' : '±'}${fmtWeight(Math.abs(weightChange), units)}`}
        label="weight trend"
      />
    </div>
  );
}
