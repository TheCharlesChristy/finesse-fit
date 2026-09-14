import { Pencil, Plus, Target, Trash2, TrendingUp, Trophy } from 'lucide-react';
import { EmptyState, OverflowMenu, PageHeader } from '../components/ui.jsx';
import { fmtDate, GOAL_STATUS, goalDescription, goalEta, goalProgress, goalValueLabel } from '../utils.js';

// "~6 weeks at this rate" — projected from the 4-week bodyweight trend, the
// same idea as a savings goal's ETA: distance left ÷ rate per period.
function EtaLine({ goal, data }) {
  if (goal?.type !== 'bodyweight') return null;
  const eta = goalEta(goal, data);
  if (!eta) return null;
  if (eta.weeks === 0) return null; // already there — the status pill says so
  if (!eta.onTrack) return <span className="muted eta-line"><TrendingUp size={13} /> Trend is moving away from target</span>;
  return <span className="muted eta-line"><TrendingUp size={13} /> ~{eta.weeks} {eta.weeks === 1 ? 'week' : 'weeks'} at this rate · {fmtDate(eta.date, 'd MMM')}</span>;
}

function GoalCard({ goal, progress, exercises, units, data, onEdit, onDelete }) {
  const status = GOAL_STATUS[progress.status];
  return (
    <article className="card panel goal-card">
      <div className="split" style={{ alignItems: 'flex-start' }}>
        <button type="button" className="goal-card-main" onClick={() => onEdit(goal)}>
          <strong>{goal.title}</strong>
          <span className="muted">{goalDescription(goal, exercises)}</span>
        </button>
        <OverflowMenu
          label={`${goal.title} actions`}
          items={[
            { label: 'Edit', icon: <Pencil size={16} />, onSelect: () => onEdit(goal) },
            { label: 'Delete', icon: <Trash2 size={16} />, danger: true, onSelect: () => onDelete(goal.id) }
          ]}
        />
      </div>
      <div className="goal-figures">
        <span className="metric">{progress.current ? goalValueLabel(goal, progress.current, units) : '—'}</span>
        <span className="muted">of {goalValueLabel(goal, progress.target, units)}</span>
      </div>
      <div className="progress-track" role="progressbar" aria-label={`${goal.title} progress`} aria-valuenow={progress.pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="progress-fill" style={{ '--value': `${progress.pct}%` }} />
      </div>
      <div className="split">
        <span className={status.className}>{status.label}</span>
        <span className="muted">{progress.pct}%</span>
      </div>
      <EtaLine goal={goal} data={data} />
    </article>
  );
}

export default function Goals({ goals, exercises, units, data, onAdd, onEdit, onDelete }) {
  const rows = goals.map((goal) => ({ goal, progress: goalProgress(goal, data) }));
  const active = rows.filter((row) => row.progress.status !== 'achieved').sort((a, b) => a.progress.pct - b.progress.pct);
  const achieved = rows.filter((row) => row.progress.status === 'achieved');
  const card = ({ goal, progress }) => <GoalCard key={goal.id} goal={goal} progress={progress} exercises={exercises} units={units} data={data} onEdit={onEdit} onDelete={onDelete} />;

  return (
    <main className="page">
      <PageHeader title="Goals" subtitle="Strength, bodyweight, weekly volume and nutrition targets.">
        <button className="btn-primary" type="button" onClick={onAdd}><Plus size={18} /> Add goal</button>
      </PageHeader>

      {!goals.length && (
        <section className="card panel">
          <EmptyState title="No goals yet">Try a strength goal like a 100 kg bench, or “hit protein 10 of 14 days”.</EmptyState>
        </section>
      )}

      {active.length > 0 && (
        <section className="section">
          <h2 className="section-heading"><Target size={16} /> In progress <span className="muted">{active.length}</span></h2>
          <div className="card-grid">{active.map(card)}</div>
        </section>
      )}

      {achieved.length > 0 && (
        <section className="section">
          <h2 className="section-heading"><Trophy size={16} /> Achieved <span className="muted">{achieved.length}</span></h2>
          <div className="card-grid">{achieved.map(card)}</div>
        </section>
      )}
    </main>
  );
}
