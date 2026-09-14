import { useMemo, useState } from 'react';
import { Dumbbell, Pencil, Plus, Repeat, Trash2, Trophy, X } from 'lucide-react';
import { CardTitle, EmptyState, OverflowMenu, SearchInput } from '../components/ui.jsx';
import { EXERCISE_CATEGORIES, EXERCISE_EQUIPMENT, categoryForExercise, categoryLabel } from '../data/exercise-library/index.js';
import { exerciseName, fmtRelativeDay, fmtWeight, muscleLabel, personalRecordsByWorkout, summariseSets } from '../utils.js';

const PAGE = 15;
const LIBRARY_PAGE = 18;
const equipmentLabel = (value) => muscleLabel(value).replace('Ez Bar', 'EZ Bar');
const exerciseTargets = (exercise) => (exercise.primaryMuscles ?? []).map(muscleLabel).slice(0, 3).join(', ');

export default function Workouts({ workouts, exercises, units, today, onAddWorkout, onRepeatWorkout, onEditWorkout, onDeleteWorkout }) {
  const [limit, setLimit] = useState(PAGE);
  const library = exercises.filter((exercise) => !exercise.isCustom);
  const [libraryFolder, setLibraryFolder] = useState('all');
  const [libraryEquipment, setLibraryEquipment] = useState('all');
  const [libraryQuery, setLibraryQuery] = useState('');
  const [libraryLimit, setLibraryLimit] = useState(LIBRARY_PAGE);
  const libraryCounts = useMemo(() => Object.fromEntries(EXERCISE_CATEGORIES.map((category) => [
    category.id,
    library.filter((exercise) => categoryForExercise(exercise) === category.id).length
  ])), [library]);
  const filteredLibrary = useMemo(() => {
    const search = libraryQuery.trim().toLowerCase();
    return library.filter((exercise) => {
      const inFolder = libraryFolder === 'all' || categoryForExercise(exercise) === libraryFolder;
      const inEquipment = libraryEquipment === 'all' || exercise.equipment === libraryEquipment;
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
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [library, libraryEquipment, libraryFolder, libraryQuery]);
  const visibleLibrary = filteredLibrary.slice(0, libraryLimit);
  const libraryHasFilters = libraryFolder !== 'all' || libraryEquipment !== 'all' || libraryQuery.trim();
  const resetLibrary = () => {
    setLibraryFolder('all');
    setLibraryEquipment('all');
    setLibraryQuery('');
    setLibraryLimit(LIBRARY_PAGE);
  };
  const updateLibraryFilter = (setter) => (event) => {
    setter(event.target.value);
    setLibraryLimit(LIBRARY_PAGE);
  };
  const records = personalRecordsByWorkout(workouts);

  return (
    <div className="layout-split">
      <div className="layout-main">
        <section className="card panel stack">
          <CardTitle icon={Dumbbell} action={workouts.length ? <span className="title-meta">{workouts.length} total</span> : null}>Sessions</CardTitle>
          <div className="list">
            {workouts.slice(0, limit).map((workout) => {
              const groups = summariseSets(workout.sets);
              const prs = records.get(workout.id);
              return (
                <div key={workout.id} className="list-row session-row">
                  <button type="button" className="session-main" onClick={() => onEditWorkout(workout)}>
                    <span className="session-title">
                      <strong>{fmtRelativeDay(workout.date, today)}</strong>
                      <span className="muted">{workout.sets?.length ?? 0} sets</span>
                      {prs && <span className="pr-badge"><Trophy size={12} /> {prs.size} PR{prs.size > 1 ? 's' : ''}</span>}
                    </span>
                    <span className="session-lines">
                      {groups.map((group) => (
                        <span key={String(group.exerciseId)} className="session-line">
                          <span className="truncate">
                            {exerciseName(exercises, group.exerciseId)} <span className="muted">× {group.sets}</span>
                            {prs?.has(String(group.exerciseId)) && <Trophy size={12} className="inline-trophy" aria-label="Personal record" />}
                          </span>
                          <span className="nowrap muted">{group.best.weight ? fmtWeight(group.best.weight, units) : 'BW'} × {group.best.reps}{group.best.rpe ? ` @${group.best.rpe}` : ''}</span>
                        </span>
                      ))}
                    </span>
                  </button>
                  <OverflowMenu
                    label="Session actions"
                    items={[
                      { label: 'Edit', icon: <Pencil size={16} />, onSelect: () => onEditWorkout(workout) },
                      { label: 'Repeat today', icon: <Repeat size={16} />, onSelect: () => onRepeatWorkout(workout) },
                      { label: 'Delete', icon: <Trash2 size={16} />, danger: true, onSelect: () => onDeleteWorkout(workout.id) }
                    ]}
                  />
                </div>
              );
            })}
            {workouts.length > limit && <button className="btn-ghost" type="button" onClick={() => setLimit(limit + PAGE)} style={{ justifySelf: 'center' }}>Show older sessions</button>}
            {!workouts.length && (
              <EmptyState
                icon={Dumbbell}
                title="No workouts yet"
                action={<button className="btn-primary" type="button" onClick={onAddWorkout}><Plus size={18} aria-hidden="true" /> Log your first workout</button>}
              >
                Log a few sets and Progress lights up straight away.
              </EmptyState>
            )}
          </div>
        </section>
      </div>

      <div className="layout-aside">
        <section className="card panel stack">
          <CardTitle icon={Dumbbell} action={<span className="title-meta">{library.length} exercises</span>}>Exercise library</CardTitle>
          <div className="exercise-library-toolbar">
            <div className="exercise-library-search-row">
              <div className="exercise-library-search">
                <SearchInput label="Search exercise library" placeholder="Search by name, muscle or equipment" value={libraryQuery} onChange={(value) => { setLibraryQuery(value); setLibraryLimit(LIBRARY_PAGE); }} />
              </div>
              {libraryHasFilters && <button type="button" className="btn-icon btn-icon-quiet" aria-label="Clear exercise library filters" title="Clear filters" onClick={resetLibrary}><X size={18} /></button>}
            </div>
            <div className="exercise-library-folders" role="tablist" aria-label="Exercise library folders">
              <button type="button" role="tab" aria-selected={libraryFolder === 'all'} className={`chip ${libraryFolder === 'all' ? 'active' : ''}`} onClick={() => { setLibraryFolder('all'); setLibraryLimit(LIBRARY_PAGE); }}>All <span>{library.length}</span></button>
              {EXERCISE_CATEGORIES.filter((category) => libraryCounts[category.id]).map((category) => (
                <button key={category.id} type="button" role="tab" aria-selected={libraryFolder === category.id} className={`chip ${libraryFolder === category.id ? 'active' : ''}`} onClick={() => { setLibraryFolder(category.id); setLibraryLimit(LIBRARY_PAGE); }}>
                  {category.label} <span>{libraryCounts[category.id]}</span>
                </button>
              ))}
            </div>
            <div className="exercise-library-filter-row">
              <div className="toolbar-summary" aria-live="polite">
                <span><strong>{filteredLibrary.length}</strong> match{filteredLibrary.length === 1 ? '' : 'es'}</span>
                {libraryHasFilters && <button type="button" className="btn-ghost" onClick={resetLibrary}>Clear filters</button>}
              </div>
              <label className="exercise-library-equipment"><span className="sr-only">Equipment</span><select className="input input-inline input-sm" aria-label="Filter library by equipment" value={libraryEquipment} onChange={updateLibraryFilter(setLibraryEquipment)}>
                <option value="all">All equipment</option>
                {EXERCISE_EQUIPMENT.filter((item) => item !== 'other').map((item) => <option key={item} value={item}>{equipmentLabel(item)}</option>)}
              </select></label>
            </div>
          </div>
          <div className="exercise-library-results">
            {visibleLibrary.map((exercise) => (
              <article key={exercise.id} className="exercise-library-item">
                <div className="exercise-library-item-heading"><strong>{exercise.name}</strong>{exercise.type && exercise.type !== 'strength' && <span className="badge highlight">{muscleLabel(exercise.type)}</span>}</div>
                <div className="exercise-library-meta">
                  <span className="badge accent">{categoryLabel(categoryForExercise(exercise))}</span>
                  <span className="badge">{equipmentLabel(exercise.equipment)}</span>
                  {exerciseTargets(exercise) && <span className="exercise-library-targets">{exerciseTargets(exercise)}</span>}
                </div>
              </article>
            ))}
            {!visibleLibrary.length && <EmptyState title="No matching exercises">Try another folder, equipment filter or search term.</EmptyState>}
          </div>
          {visibleLibrary.length < filteredLibrary.length && <button type="button" className="btn-secondary exercise-library-more" onClick={() => setLibraryLimit((limit) => limit + LIBRARY_PAGE)}>
            Show more <span className="muted">({filteredLibrary.length - visibleLibrary.length} remaining)</span>
          </button>}
            {visibleLibrary.length > 0 && <span className="muted list-note">Showing {visibleLibrary.length} of {filteredLibrary.length} matches.</span>}
        </section>
      </div>
    </div>
  );
}
