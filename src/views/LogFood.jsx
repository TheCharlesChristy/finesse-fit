import { useState } from 'react';
import { Barcode, ChevronRight, CopyPlus, Globe, LoaderCircle, Plus, RotateCcw, ScanText, Search, Zap } from 'lucide-react';
import { CardTitle, EmptyState, PageHeader, SearchInput, Segmented } from '../components/ui.jsx';
import { dateKey, fmtCalories, fmtRelativeDay, groupLogsByMeal, mealLabel, servingLabel, shiftDay, sumComputed } from '../utils.js';

const matches = (food, needle) => `${food.name} ${food.brand ?? ''} ${food.barcode ?? ''}`.toLowerCase().includes(needle);

const SHORTCUT_TABS = [
  { value: 'recent', label: 'Recent' },
  { value: 'meals', label: 'Meals' },
  { value: 'history', label: 'History' }
];

export default function LogFood({ foods, foodLogs, meals = [], today, onScan, onScanLabel, onPickFood, onAddFood, onEditLog, onLogMeal, onCopyLogs, onQuickAdd, onlineSearch, onSearchOnline, onPickOnline }) {
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState('recent');
  const needle = query.trim().toLowerCase();
  const recentIds = [...new Set(foodLogs.map((log) => log.foodId))].slice(0, 8);
  const recent = recentIds.map((id) => foods.find((food) => food.id === id)).filter(Boolean);
  const results = needle ? foods.filter((food) => matches(food, needle)) : foods;
  const shown = results.slice(0, needle ? 30 : 12);
  const online = onlineSearch?.query === needle ? onlineSearch : null;
  const libraryBarcodes = new Set(foods.map((food) => food.barcode).filter(Boolean));
  const yesterdayMeals = groupLogsByMeal(foodLogs.filter((log) => dateKey(log.date) === shiftDay(today, -1)));

  return (
    <main className="page">
      <PageHeader title="Foods" subtitle="Scan, search, or add calories directly." />

      <div className="action-tiles">
        <button className="action-tile primary" type="button" onClick={onScan}>
          <span className="action-tile-icon"><Barcode size={24} /></span>
          <span className="action-tile-text"><strong>Scan barcode</strong><span>Fastest for packaged food</span></span>
          <ChevronRight size={20} className="action-tile-chevron" aria-hidden="true" />
        </button>
        <button className="action-tile" type="button" onClick={onScanLabel}>
          <span className="action-tile-icon"><ScanText size={22} /></span>
          <span className="action-tile-text"><strong>Scan label</strong><span>Read macros from the pack</span></span>
          <ChevronRight size={20} className="action-tile-chevron" aria-hidden="true" />
        </button>
        <button className="action-tile" type="button" onClick={onQuickAdd}>
          <span className="action-tile-icon"><Zap size={22} /></span>
          <span className="action-tile-text"><strong>Quick add</strong><span>Just calories &amp; macros</span></span>
          <ChevronRight size={20} className="action-tile-chevron" aria-hidden="true" />
        </button>
      </div>

      <div className="layout-split">
        <div className="layout-main">
          <section className="card panel stack">
            <CardTitle icon={Search} action={<button className="btn-ghost" type="button" onClick={onAddFood}><Plus size={16} /> New food</button>}>Find a food</CardTitle>
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder={foods.length ? `Search ${foods.length} saved foods, or online` : 'Search foods online'}
              label="Search foods"
              onEnter={() => needle.length >= 2 && !online && onSearchOnline(query)}
            />
            <div className="list">
              {needle && <span className="meal-heading">Your library</span>}
              {shown.map((food) => (
                <button key={food.id} type="button" className="list-row split compact" onClick={() => onPickFood(food)}>
                  <span className="truncate"><strong>{food.name}</strong><span className="muted"> · {food.brand ?? servingLabel(food)}</span></span>
                  <span className="muted nowrap">{fmtCalories(food.per100?.calories)}/100g</span>
                </button>
              ))}
              {results.length > shown.length && <span className="muted list-note">{results.length - shown.length} more — refine your search</span>}
              {!foods.length && !needle && <EmptyState title="Your library is empty">Scan a barcode, search online, or add a custom food. Foods you use are saved here.</EmptyState>}
              {needle && !results.length && <span className="muted list-note">No saved foods match “{query.trim()}”.</span>}
            </div>

            {needle.length >= 2 && (
              <div className="stack online-search">
                <span className="meal-heading">Open Food Facts</span>
                {!online && (
                  <button className="btn-secondary" type="button" onClick={() => onSearchOnline(query)}>
                    <Globe size={17} /> Search online for “{query.trim()}”
                  </button>
                )}
                {online?.status === 'loading' && <span className="row muted"><LoaderCircle size={16} className="spin" /> Searching…</span>}
                {online?.status === 'error' && (
                  <div className="banner warn compact">
                    <span className="banner-text">{online.message}</span>
                    <button className="btn-ghost" type="button" onClick={() => onSearchOnline(query)}><RotateCcw size={15} /> Retry</button>
                  </div>
                )}
                {online?.status === 'done' && (
                  <div className="list">
                    {online.results.map((food) => (
                      <button key={food.barcode} type="button" className="list-row split compact" onClick={() => onPickOnline(food)}>
                        <span className="truncate"><strong>{food.name}</strong><span className="muted"> · {[food.brand, food.servings[0].label !== '100 g' ? servingLabel(food) : null].filter(Boolean).join(' · ') || 'no brand'}</span></span>
                        <span className="row nowrap" style={{ gap: 8, flexWrap: 'nowrap' }}>
                          {libraryBarcodes.has(food.barcode) && <span className="status-good">saved</span>}
                          <span className="muted">{fmtCalories(food.per100.calories)}/100g</span>
                        </span>
                      </button>
                    ))}
                    {!online.results.length && <EmptyState title="No products with nutrition info">Try a simpler name, or add it as a custom food.</EmptyState>}
                  </div>
                )}
                <div className="split online-footer">
                  <span className="muted">Only your search words are sent. Picked foods are saved for offline use.</span>
                  <button className="btn-ghost" type="button" onClick={onAddFood}><Plus size={15} /> Add manually</button>
                </div>
              </div>
            )}
          </section>
        </div>

        <div className="layout-aside">
          <section className="card panel stack">
            <Segmented label="Shortcuts" hideLabel value={tab} options={SHORTCUT_TABS} onChange={setTab} />

            {tab === 'recent' && (
              <div className="list">
                {recent.map((food) => (
                  <button key={food.id} type="button" className="list-row split compact" onClick={() => onPickFood(food)}>
                    <strong className="truncate">{food.name}</strong><span className="muted nowrap">{food.brand ?? servingLabel(food)}</span>
                  </button>
                ))}
                {!recent.length && <EmptyState title="Nothing recent yet">Foods you log appear here for one-tap re-logging.</EmptyState>}
              </div>
            )}

            {tab === 'meals' && (
              <>
                {yesterdayMeals.length > 0 && (
                  <div className="meal-group">
                    <span className="meal-heading">Copy from yesterday</span>
                    <div className="chip-row">
                      {yesterdayMeals.map((group) => (
                        <button key={group.meal} type="button" className="chip" onClick={() => onCopyLogs(group.logs, group.meal)}>
                          <CopyPlus size={14} /> {mealLabel(group.meal)} · {fmtCalories(group.calories)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="meal-group">
                  {yesterdayMeals.length > 0 && <span className="meal-heading">Saved meals</span>}
                  <div className="list">
                    {meals.map((meal) => (
                      <button key={meal.id} type="button" className="list-row split compact" onClick={() => onLogMeal(meal)}>
                        <span className="truncate"><strong>{meal.name}</strong><span className="muted"> · {meal.items.length} {meal.items.length === 1 ? 'item' : 'items'}</span></span>
                        <span className="nowrap secondary">{fmtCalories(sumComputed(meal.items).calories)}</span>
                      </button>
                    ))}
                    {!meals.length && <EmptyState title="No saved meals">On Today, tap the bookmark beside a meal to save it for one-tap logging.</EmptyState>}
                  </div>
                </div>
              </>
            )}

            {tab === 'history' && (
              <div className="list">
                {foodLogs.slice(0, 12).map((log) => (
                  <button key={log.id} type="button" className="list-row split compact" onClick={() => onEditLog(log)}>
                    <span className="truncate"><strong>{log.foodName}</strong><span className="muted"> · {fmtRelativeDay(log.date, today)} · {mealLabel(log.mealType)}</span></span>
                    <span className="nowrap secondary">{fmtCalories(log.computed.calories)}</span>
                  </button>
                ))}
                {!foodLogs.length && <EmptyState title="No history yet">Everything you log shows up here.</EmptyState>}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
