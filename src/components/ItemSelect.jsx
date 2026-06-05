import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';

export default function ItemSelect({ items = [], value, onChange, labelKey = 'name', placeholder = 'Search' }) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return items.slice(0, 8);
    return items.filter((item) => `${item[labelKey]} ${item.brand ?? ''}`.toLowerCase().includes(needle)).slice(0, 12);
  }, [items, labelKey, query]);

  return (
    <div className="stack">
      <div style={{ position: 'relative' }}>
        <Search size={17} style={{ position: 'absolute', left: 12, top: 14, color: 'var(--text-muted)' }} />
        <input className="glass-input" style={{ paddingLeft: 38 }} placeholder={placeholder} value={query} onChange={(event) => setQuery(event.target.value)} />
      </div>
      <div className="list" role="listbox">
        {filtered.map((item) => (
          <button
            key={item.id}
            type="button"
            className="list-row split"
            style={{ textAlign: 'left', borderColor: String(value) === String(item.id) ? 'var(--accent-mint)' : undefined }}
            onClick={() => onChange(item)}
          >
            <span><strong>{item[labelKey]}</strong>{item.brand && <span className="muted"> · {item.brand}</span>}</span>
            <span className="muted">{item.equipment ?? item.source ?? ''}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
