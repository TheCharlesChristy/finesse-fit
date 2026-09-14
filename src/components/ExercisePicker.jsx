import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { EXERCISE_CATEGORIES, EXERCISE_EQUIPMENT, categoryForExercise, categoryLabel } from '../data/exercise-library/index.js';
import { muscleLabel } from '../utils.js';

const DISPLAY_LIMIT = 80;
const labelForEquipment = (value) => muscleLabel(value).replace('Ez Bar', 'EZ Bar');

export default function ExercisePicker({ value, exercises, onChange, recentExerciseIds = [] }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [folder, setFolder] = useState('all');
  const [equipment, setEquipment] = useState('all');
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const searchRef = useRef(null);
  const [popoverStyle, setPopoverStyle] = useState(null);
  const uniqueId = useId();
  const listId = `exercise-picker-${uniqueId.replaceAll(':', '')}`;
  const current = exercises.find((exercise) => String(exercise.id) === String(value));
  const library = useMemo(() => exercises, [exercises]);
  const recency = useMemo(() => new Map([...recentExerciseIds].map((id, index) => [String(id), index])), [recentExerciseIds]);

  const folderCounts = useMemo(() => Object.fromEntries(EXERCISE_CATEGORIES.map((category) => [
    category.id,
    library.filter((exercise) => categoryForExercise(exercise) === category.id).length
  ])), [library]);

  const results = useMemo(() => {
    const search = query.trim().toLowerCase();
    return library.filter((exercise) => {
      const inFolder = folder === 'all' || categoryForExercise(exercise) === folder;
      const inEquipment = equipment === 'all' || exercise.equipment === equipment;
      const haystack = [
        exercise.name,
        ...(exercise.aliases ?? []),
        ...(exercise.primaryMuscles ?? []),
        ...(exercise.secondaryMuscles ?? []),
        exercise.sourceCategory,
        exercise.equipment,
        exercise.type
      ].filter(Boolean).join(' ').toLowerCase();
      return inFolder && inEquipment && (!search || haystack.includes(search));
    }).sort((a, b) => {
      const aRecent = recency.has(String(a.id)) ? recency.get(String(a.id)) : Number.POSITIVE_INFINITY;
      const bRecent = recency.has(String(b.id)) ? recency.get(String(b.id)) : Number.POSITIVE_INFINITY;
      if (aRecent !== bRecent) return aRecent - bRecent;
      return a.name.localeCompare(b.name);
    });
  }, [equipment, folder, library, query, recency]);

  const positionPopover = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.min(520, window.innerWidth - 24);
    const left = Math.min(Math.max(12, rect.left), window.innerWidth - width - 12);
    const below = window.innerHeight - rect.bottom - 12;
    const above = rect.top - 12;
    const maxHeight = Math.min(560, Math.max(260, Math.max(below, above)));
    const top = below >= 320 || below >= above ? rect.bottom + 8 : Math.max(12, rect.top - maxHeight - 8);
    setPopoverStyle({ top, left, width, maxHeight });
  };

  useEffect(() => {
    if (!open) return undefined;
    positionPopover();
    searchRef.current?.focus();
    const onPointer = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    const onViewportChange = () => positionPopover();
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onViewportChange);
    window.addEventListener('scroll', onViewportChange, true);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onViewportChange);
      window.removeEventListener('scroll', onViewportChange, true);
    };
  }, [open]);

  const choose = (exercise) => {
    onChange(String(exercise.id));
    setOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <div className="exercise-picker" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className={`exercise-picker-trigger ${open ? 'open' : ''}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((isOpen) => !isOpen)}
      >
        <span className="exercise-picker-copy">
          <strong className="exercise-picker-name truncate">{current?.name ?? 'Choose an exercise'}</strong>
          <span className="exercise-picker-meta">{current ? `${current.isCustom ? 'Your exercise' : categoryLabel(categoryForExercise(current))} · ${labelForEquipment(current.equipment)}` : 'Search the library'}</span>
        </span>
        <ChevronDown size={18} aria-hidden="true" />
      </button>

      {open && popoverStyle && (
        <div id={listId} className="exercise-picker-popover card-raised" role="dialog" aria-label="Choose exercise" style={popoverStyle}>
          <div className="exercise-picker-search-row">
            <div className="search-input exercise-picker-search">
              <Search size={17} aria-hidden="true" />
              <input ref={searchRef} className="input" type="search" aria-label="Search exercises" placeholder="Search by name, muscle or equipment" value={query} onChange={(event) => setQuery(event.target.value)} />
            </div>
            <button type="button" className="btn-icon btn-icon-quiet" aria-label="Close exercise picker" title="Close" onClick={() => { setOpen(false); triggerRef.current?.focus(); }}><X size={18} /></button>
          </div>

          <div className="exercise-picker-controls">
            <div className="exercise-picker-folders" role="tablist" aria-label="Exercise folders">
              <button type="button" role="tab" aria-selected={folder === 'all'} className={`chip ${folder === 'all' ? 'active' : ''}`} onClick={() => setFolder('all')}>All <span>{library.length}</span></button>
              {EXERCISE_CATEGORIES.filter((category) => folderCounts[category.id]).map((category) => (
                <button key={category.id} type="button" role="tab" aria-selected={folder === category.id} className={`chip ${folder === category.id ? 'active' : ''}`} onClick={() => setFolder(category.id)}>
                  {category.label} <span>{folderCounts[category.id]}</span>
                </button>
              ))}
            </div>
            <label className="exercise-picker-equipment"><span className="sr-only">Equipment</span><select className="input compact-select" aria-label="Filter by equipment" value={equipment} onChange={(event) => setEquipment(event.target.value)}>
              <option value="all">All equipment</option>
              {EXERCISE_EQUIPMENT.filter((item) => item !== 'other').map((item) => <option key={item} value={item}>{labelForEquipment(item)}</option>)}
            </select></label>
          </div>

          <div className="exercise-picker-summary" aria-live="polite">
            <span><strong>{results.length}</strong> match{results.length === 1 ? '' : 'es'}</span>
            {(query || folder !== 'all' || equipment !== 'all') && <button type="button" className="btn-link" onClick={() => { setQuery(''); setFolder('all'); setEquipment('all'); }}>Clear filters</button>}
          </div>

          <div className="exercise-picker-results" role="listbox" aria-label="Exercise results">
            {results.slice(0, DISPLAY_LIMIT).map((exercise) => {
              const selected = String(exercise.id) === String(value);
              const recent = recency.has(String(exercise.id));
              return (
                <button key={exercise.id} type="button" role="option" aria-selected={selected} className={`exercise-picker-option ${selected ? 'selected' : ''}`} onClick={() => choose(exercise)}>
                  <span className="exercise-picker-option-copy">
                    <strong>{exercise.name}</strong>
                  <span>{exercise.isCustom ? 'Your exercise' : categoryLabel(categoryForExercise(exercise))} · {labelForEquipment(exercise.equipment)}{exercise.type && exercise.type !== 'strength' ? ` · ${muscleLabel(exercise.type)}` : ''}</span>
                  </span>
                  {recent && <span className="exercise-picker-recent">In workout</span>}
                  {selected && <Check size={17} aria-label="Selected" />}
                </button>
              );
            })}
            {!results.length && <div className="exercise-picker-empty"><strong>No exercises found</strong><span>Try a different search or folder.</span></div>}
            {results.length > DISPLAY_LIMIT && <div className="exercise-picker-more">Showing the first {DISPLAY_LIMIT}. Search or choose a folder to narrow the list.</div>}
          </div>
        </div>
      )}
    </div>
  );
}
