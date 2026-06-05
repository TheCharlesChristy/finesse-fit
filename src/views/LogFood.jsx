import { Apple, Barcode, Plus, Search } from 'lucide-react';
import { CardTitle, EmptyState } from '../components/ui.jsx';
import { fmtCalories, mealLabel } from '../utils.js';

export default function LogFood({ foods, foodLogs, onScan, onPickFood, onAddFood, onEditLog }) {
  const recentIds = [...new Set(foodLogs.map((log) => log.foodId))].slice(0, 8);
  const recent = recentIds.map((id) => foods.find((food) => food.id === id)).filter(Boolean);

  return (
    <main className="page">
      <div>
        <h1 className="font-display page-title">Log Food</h1>
        <p className="secondary">Scan first. Search and manual entry are always here when the camera or product database is not.</p>
      </div>

      <button className="btn-primary hero-action" type="button" onClick={onScan}>
        <Barcode size={34} /> Scan barcode
      </button>

      <div className="grid-auto">
        <section className="glass panel stack">
          <CardTitle icon={Search} action={<button className="btn-secondary" type="button" onClick={onAddFood}><Plus size={18} /> Add</button>}>Food library</CardTitle>
          <div className="list">
            {foods.slice(0, 10).map((food) => (
              <button key={food.id} type="button" className="list-row split" onClick={() => onPickFood(food)}>
                <span><strong>{food.name}</strong><span className="muted"> · {food.brand ?? food.source}</span></span>
                <span>{fmtCalories(food.per100.calories)}/100g</span>
              </button>
            ))}
            {!foods.length && <EmptyState title="No foods yet">Scan a barcode or add a custom food.</EmptyState>}
          </div>
        </section>

        <section className="glass panel stack">
          <CardTitle icon={Apple}>Recent foods</CardTitle>
          <div className="list">
            {recent.map((food) => (
              <button key={food.id} type="button" className="list-row split" onClick={() => onPickFood(food)}>
                <strong>{food.name}</strong><span className="muted">{food.brand ?? 'recent'}</span>
              </button>
            ))}
            {!recent.length && <EmptyState title="Nothing recent yet">Logged foods appear here for faster re-entry.</EmptyState>}
          </div>
        </section>

        <section className="glass panel stack">
          <CardTitle icon={Apple}>Latest logs</CardTitle>
          <div className="list">
            {foodLogs.slice(0, 8).map((log) => (
              <button key={log.id} type="button" className="list-row split" onClick={() => onEditLog(log)}>
                <span><strong>{log.foodName}</strong><span className="muted"> · {mealLabel(log.mealType)}</span></span>
                <span>{fmtCalories(log.computed.calories)}</span>
              </button>
            ))}
            {!foodLogs.length && <EmptyState title="No logs">Your eating history will show up here.</EmptyState>}
          </div>
        </section>
      </div>
    </main>
  );
}
