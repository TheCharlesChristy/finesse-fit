import { Edit3, Plus, Trash2 } from 'lucide-react';
import { CardTitle, EmptyState, IconButton } from '../components/ui.jsx';
import { goalProgress, percent } from '../utils.js';

export default function Goals({ goals, data, onAdd, onEdit, onDelete }) {
  return (
    <main className="page">
      <div className="split">
        <div>
          <h1 className="font-display page-title">Goals</h1>
          <p className="secondary">Strength, bodyweight, weekly volume, and nutrition adherence targets.</p>
        </div>
        <button className="btn-primary" type="button" onClick={onAdd}><Plus size={18} /> Add goal</button>
      </div>
      <section className="glass panel stack">
        <CardTitle>Active goals</CardTitle>
        <div className="list">
          {goals.map((goal) => {
            const progress = goalProgress(goal, data);
            return (
              <div key={goal.id} className="list-row stack">
                <div className="split">
                  <div><strong>{goal.title}</strong><div className="muted">{goal.type}</div></div>
                  <div className="row">
                    <span className={progress.status === 'achieved' ? 'status-good' : progress.status === 'on-track' ? 'status-warn' : 'status-danger'}>{progress.status}</span>
                    <IconButton label="Edit goal" onClick={() => onEdit(goal)}><Edit3 size={17} /></IconButton>
                    <IconButton label="Delete goal" onClick={() => onDelete(goal.id)}><Trash2 size={17} /></IconButton>
                  </div>
                </div>
                <div className="progress-track"><div className="progress-fill" style={{ '--value': `${Math.min(100, percent(progress.current, progress.target))}%` }} /></div>
                <span className="secondary">{progress.current} / {progress.target}</span>
              </div>
            );
          })}
          {!goals.length && <EmptyState title="No goals yet">Create one of each type to track progress reactively.</EmptyState>}
        </div>
      </section>
    </main>
  );
}
