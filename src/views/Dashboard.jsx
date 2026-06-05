import { Activity, Apple, Dumbbell, Target } from 'lucide-react';
import { CardTitle, EmptyState } from '../components/ui.jsx';
import { dateKey, fmtCalories, fmtMacro, goalProgress, mealLabel, percent, weekKey } from '../utils.js';

function MacroCard({ label, value, target, format }) {
  const pct = percent(value, target);
  return (
    <div className="glass panel stack">
      <div className="split"><strong>{label}</strong><span className={pct > 110 ? 'status-danger' : pct >= 80 ? 'status-good' : 'status-warn'}>{pct}%</span></div>
      <div className="metric">{format(value)}</div>
      <div className="progress-track"><div className="progress-fill" style={{ '--value': `${Math.min(100, pct)}%` }} /></div>
      <span className="muted">Target {format(target)}</span>
    </div>
  );
}

export default function Dashboard({ profile, foodLogs, dailyTotals, workouts, muscleVolume, goals, bodyweightLogs, onSetView, onProfile }) {
  const today = dateKey();
  const totals = dailyTotals.find((row) => row.date === today) ?? {};
  const todayLogs = foodLogs.filter((log) => dateKey(log.date) === today);
  const week = weekKey(today);
  const weekVolume = muscleVolume.filter((row) => row.weekKey === week).reduce((sum, row) => sum + row.volume, 0);

  return (
    <main className="page">
      <div className="split">
        <div>
          <h1 className="font-display page-title">Dashboard</h1>
          <p className="secondary">Today’s nutrition, this week’s training, and active goals.</p>
        </div>
        <button className="btn-secondary" type="button" onClick={onProfile}>Profile</button>
      </div>

      <div className="grid-auto">
        <MacroCard label="Calories" value={totals.calories ?? 0} target={profile.targets.calories} format={fmtCalories} />
        <MacroCard label="Protein" value={totals.protein ?? 0} target={profile.targets.protein} format={fmtMacro} />
        <MacroCard label="Carbs" value={totals.carbs ?? 0} target={profile.targets.carbs} format={fmtMacro} />
        <MacroCard label="Fat" value={totals.fat ?? 0} target={profile.targets.fat} format={fmtMacro} />
      </div>

      <div className="grid-auto">
        <section className="glass panel stack">
          <CardTitle icon={Apple}>Today’s meals</CardTitle>
          <div className="list">
            {todayLogs.length ? todayLogs.map((log) => (
              <div key={log.id} className="list-row split">
                <span><strong>{log.foodName}</strong><span className="muted"> · {mealLabel(log.mealType)}</span></span>
                <span>{fmtCalories(log.computed.calories)}</span>
              </div>
            )) : <EmptyState title="No meals logged">Scan or search a food to start the day.</EmptyState>}
          </div>
          <button className="btn-primary" type="button" onClick={() => onSetView('logFood')}>Log food</button>
        </section>

        <section className="glass panel stack">
          <CardTitle icon={Dumbbell}>Training week</CardTitle>
          <div className="metric">{Math.round(weekVolume).toLocaleString()}</div>
          <span className="muted">Attributed muscle volume this ISO week.</span>
          <button className="btn-secondary" type="button" onClick={() => onSetView('workouts')}>Log workout</button>
        </section>

        <section className="glass panel stack">
          <CardTitle icon={Target}>Goals</CardTitle>
          {goals.length ? goals.slice(0, 4).map((goal) => {
            const progress = goalProgress(goal, { workouts, muscleVolume, dailyTotals, bodyweightLogs });
            return (
              <div key={goal.id} className="list-row">
                <div className="split"><strong>{goal.title}</strong><span className={progress.status === 'achieved' ? 'status-good' : progress.status === 'on-track' ? 'status-warn' : 'status-danger'}>{progress.status}</span></div>
                <div className="progress-track" style={{ marginTop: 10 }}><div className="progress-fill" style={{ '--value': `${Math.min(100, percent(progress.current, progress.target))}%` }} /></div>
              </div>
            );
          }) : <EmptyState title="No goals yet">Add one strength, bodyweight, volume, or nutrition goal.</EmptyState>}
        </section>

        <section className="glass panel stack">
          <CardTitle icon={Activity}>First run</CardTitle>
          <p className="secondary">Set your targets, add a food, and log a first workout. The app works offline after first load.</p>
          <button className="btn-secondary" type="button" onClick={onProfile}>Adjust targets</button>
        </section>
      </div>
    </main>
  );
}
