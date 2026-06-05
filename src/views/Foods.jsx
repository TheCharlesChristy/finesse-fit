import { Edit3, Plus, Trash2 } from 'lucide-react';
import { CardTitle, EmptyState, IconButton } from '../components/ui.jsx';
import { fmtCalories, fmtMacro } from '../utils.js';

export default function Foods({ foods, onAdd, onEdit, onDelete }) {
  return (
    <main className="page">
      <div className="split">
        <div>
          <h1 className="font-display page-title">Foods</h1>
          <p className="secondary">Local cache and custom foods. Historical logs keep frozen nutrition.</p>
        </div>
        <button className="btn-primary" type="button" onClick={onAdd}><Plus size={18} /> Add food</button>
      </div>
      <section className="glass panel stack">
        <CardTitle>Food library</CardTitle>
        <div className="list">
          {foods.map((food) => (
            <div key={food.id} className="list-row split">
              <div>
                <strong>{food.name}</strong>
                <div className="muted">{food.brand ?? food.source} · {food.barcode ?? 'no barcode'}</div>
              </div>
              <div className="row">
                <span className="secondary">{fmtCalories(food.per100.calories)} · P {fmtMacro(food.per100.protein)}</span>
                <IconButton label="Edit food" onClick={() => onEdit(food)}><Edit3 size={17} /></IconButton>
                <IconButton label="Delete food" onClick={() => onDelete(food.id)}><Trash2 size={17} /></IconButton>
              </div>
            </div>
          ))}
          {!foods.length && <EmptyState title="No foods yet">Add a custom food or scan a barcode from Log Food.</EmptyState>}
        </div>
      </section>
    </main>
  );
}
