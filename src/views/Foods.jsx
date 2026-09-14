import { useState } from 'react';
import { Apple, Pencil, Plus, Soup, Trash2 } from 'lucide-react';
import { CardTitle, EmptyState, OverflowMenu, PageHeader, SearchInput } from '../components/ui.jsx';
import { fmtCalories, fmtMacro, servingLabel } from '../utils.js';

const SOURCE_LABEL = { scan: 'Scanned', search: 'Online', custom: 'Custom' };

export default function Foods({ foods, foodLogs, onAdd, onEdit, onLog, onDelete }) {
  const [query, setQuery] = useState('');
  const needle = query.trim().toLowerCase();
  const results = needle ? foods.filter((food) => `${food.name} ${food.brand ?? ''} ${food.barcode ?? ''}`.toLowerCase().includes(needle)) : foods;
  const useCount = foodLogs.reduce((counts, log) => counts.set(log.foodId, (counts.get(log.foodId) ?? 0) + 1), new Map());

  return (
    <main className="page">
      <PageHeader title="Foods" subtitle="Tap a food to log it. Editing a food never changes past logs.">
        <button className="btn-primary" type="button" onClick={onAdd}><Plus size={18} /> Add food</button>
      </PageHeader>
      <section className="card panel stack page-narrow">
        <CardTitle icon={Apple} action={<span className="title-meta">{foods.length} saved</span>}>Library</CardTitle>
        {foods.length > 0 && <SearchInput value={query} onChange={setQuery} placeholder="Search by name, brand or barcode" label="Search foods" />}
        <div className="list">
          {results.map((food) => (
            <div key={food.id} className="list-row food-row">
              <button type="button" className="food-row-main" onClick={() => onLog(food)}>
                <span className="split" style={{ gap: 10 }}>
                  <strong className="truncate">{food.name}</strong>
                  <span className="nowrap secondary">{fmtCalories(food.per100?.calories)}<span className="muted"> /100g</span></span>
                </span>
                <span className="muted truncate">{[food.brand, servingLabel(food), SOURCE_LABEL[food.source], useCount.get(food.id) ? `logged ${useCount.get(food.id)}×` : null].filter(Boolean).join(' · ')}</span>
                <span className="macro-pills">
                  <span>P {fmtMacro(food.per100?.protein)}</span>
                  <span>C {fmtMacro(food.per100?.carbs)}</span>
                  <span>F {fmtMacro(food.per100?.fat)}</span>
                  {food.per100?.fibre > 0 && <span>Fibre {fmtMacro(food.per100.fibre)}</span>}
                </span>
              </button>
              <OverflowMenu
                label={`${food.name} actions`}
                items={[
                  { label: 'Log', icon: <Soup size={16} />, onSelect: () => onLog(food) },
                  { label: 'Edit', icon: <Pencil size={16} />, onSelect: () => onEdit(food) },
                  { label: 'Delete', icon: <Trash2 size={16} />, danger: true, onSelect: () => onDelete(food.id) }
                ]}
              />
            </div>
          ))}
          {!foods.length && <EmptyState title="No foods yet">Scan a barcode or search online from Log Food, or add a custom food.</EmptyState>}
          {foods.length > 0 && !results.length && <EmptyState title={`No match for “${query.trim()}”`} />}
        </div>
      </section>
    </main>
  );
}
