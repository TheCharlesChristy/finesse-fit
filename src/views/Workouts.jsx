import { useMemo, useState } from 'react';
import { ChevronRight, Copy, Dumbbell, Footprints, History, ListChecks, MapPinned, Pencil, Play, Plus, Repeat, Trash2, Trophy, X } from 'lucide-react';
import { CardTitle, EmptyState, OverflowMenu, PageHeader, SearchInput } from '../components/ui.jsx';
import { EXERCISE_CATEGORIES, EXERCISE_EQUIPMENT, categoryForExercise, categoryLabel } from '../data/exercise-library/index.js';
import { fmtClock, fmtDistance, fmtPace, paceOf, previewPath, samplePath } from '../geo.js';
import { activityLabel, describeBlock, estimatePlanSeconds, fmtSpan, planCounts, planHasGps } from '../plans.js';
import { exerciseName, fmtRelativeDay, fmtWeight, muscleLabel, personalRecordsByWorkout, summariseSets } from '../utils.js';

const PAGE = 15;
const LIBRARY_PAGE = 18;
const equipmentLabel = (value) => muscleLabel(value).replace('Ez Bar', 'EZ Bar');
const exerciseTargets = (exercise) => (exercise.primaryMuscles ?? []).map(muscleLabel).slice(0, 3).join(', ');

function RouteThumb({ path, className = 'route-thumb' }) {
  const d = useMemo(() => previewPath([samplePath(path ?? [], 80)], 72, 48, 5), [path]);
  if (!d) return null;
  return <svg className={className} viewBox="0 0 72 48" aria-hidden="true"><path d={d} /></svg>;
}

function planMeta(plan) {
  const counts = planCounts(plan.blocks);
  const minutes = Math.max(1, Math.round(estimatePlanSeconds(plan.blocks) / 60));
  return [`~${fmtSpan(minutes * 60)}`, counts.exercises ? `${counts.exercises} exercise${counts.exercises === 1 ? '' : 's'}` : null, counts.sets ? `${counts.sets} sets` : null].filter(Boolean).join(' · ');
}

export default function Workouts({
  workouts, exercises, units, today, onAddWorkout, onRepeatWorkout, onEditWorkout, onDeleteWorkout,
  plans = [], routes = [], sessionName, onOpenSession, onStartPlan, onQuickStart, onNewPlan, onEditPlan, onDuplicatePlan, onDeletePlan,
  onPlanRoute, onEditRoute, onRunRoute, onDeleteRoute, onOpenActivity
}) {
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
    <main className="page">
      <PageHeader title="Workouts" subtitle="Design a plan, start it, tick it off as you go.">
        <button className="btn-secondary" type="button" onClick={onAddWorkout}><History size={18} /> Log past workout</button>
        <button className="btn-primary" type="button" onClick={onNewPlan}><Plus size={18} /> New plan</button>
      </PageHeader>

      {sessionName && (
        <button type="button" className="card banner session-banner" onClick={onOpenSession}>
          <span className="live-dot recording" aria-hidden="true" />
          <span className="banner-text"><strong>{sessionName} is in progress</strong><span className="muted">Pick up where you left off.</span></span>
          <span className="btn-primary banner-actions">Open <ChevronRight size={17} /></span>
        </button>
      )}

      <div className="layout-split">
        <div className="layout-main">
          <section className="card panel stack">
            <CardTitle icon={ListChecks} action={<button className="btn-ghost" type="button" onClick={onNewPlan}><Plus size={16} /> New plan</button>}>Start a workout</CardTitle>
            <div className="quick-starts">
              <button type="button" className="action-tile primary" onClick={() => onQuickStart('run')}>
                <span className="action-tile-icon"><Footprints size={22} /></span>
                <span className="action-tile-text"><strong>Free run</strong><span>GPS-tracked, finish whenever</span></span>
              </button>
              <button type="button" className="action-tile" onClick={() => onQuickStart('empty')}>
                <span className="action-tile-icon"><Dumbbell size={22} /></span>
                <span className="action-tile-text"><strong>Empty workout</strong><span>Add exercises as you go</span></span>
              </button>
            </div>
            {plans.length ? (
              <div className="list">
                {plans.map((plan) => (
                  <div key={plan.id} className="list-row plan-row">
                    <button type="button" className="plan-row-main" onClick={() => onEditPlan(plan)}>
                      <strong className="truncate">{plan.name}</strong>
                      <span className="muted truncate">{plan.blocks.slice(0, 3).map((block) => describeBlock(block, exercises, units).title).join(' → ')}{plan.blocks.length > 3 ? ' …' : ''}</span>
                      <span className="plan-row-meta">{planMeta(plan)}{planHasGps(plan.blocks) && <span className="library-tag"><MapPinned size={11} /> GPS</span>}</span>
                    </button>
                    <button type="button" className="btn-primary plan-start" onClick={() => onStartPlan(plan)} aria-label={`Start ${plan.name}`}><Play size={17} /> <span>Start</span></button>
                    <OverflowMenu label={`${plan.name} actions`} items={[
                      { label: 'Edit', icon: <Pencil size={16} />, onSelect: () => onEditPlan(plan) },
                      { label: 'Duplicate', icon: <Copy size={16} />, onSelect: () => onDuplicatePlan(plan) },
                      { label: 'Delete', icon: <Trash2 size={16} />, danger: true, onSelect: () => onDeletePlan(plan.id) }
                    ]} />
                  </div>
                ))}
              </div>
            ) : <EmptyState title="No plans yet">Design a workout once — sets, circuits, runs or intervals — then start it in one tap.</EmptyState>}
          </section>

          <section className="card panel stack">
            <CardTitle icon={Dumbbell} action={workouts.length ? <span className="title-meta">{workouts.length} total</span> : null}>Sessions</CardTitle>
            <div className="list">
              {workouts.slice(0, limit).map((workout) => {
                const groups = summariseSets(workout.sets);
                const prs = records.get(workout.id);
                const cardio = workout.cardio ?? [];
                const isActivity = cardio.length > 0 || workout.durationSeconds > 0;
                const moving = workout.movingSeconds ?? cardio.reduce((sum, item) => sum + (item.seconds ?? 0), 0);
                const meta = [workout.sets?.length ? `${workout.sets.length} sets` : null, workout.durationSeconds ? fmtClock(workout.durationSeconds) : null].filter(Boolean).join(' · ');
                return (
                  <div key={workout.id} className="list-row session-row">
                    <button type="button" className="session-main" onClick={() => (isActivity ? onOpenActivity(workout) : onEditWorkout(workout))}>
                      <span className="session-title">
                        <strong>{fmtRelativeDay(workout.date, today)}</strong>
                        {workout.name && <span className="secondary truncate">{workout.name}</span>}
                        {meta && <span className="muted">{meta}</span>}
                        {prs && <span className="pr-badge"><Trophy size={12} /> {prs.size} PR{prs.size > 1 ? 's' : ''}</span>}
                      </span>
                      {cardio.length > 0 && (
                        <span className="session-line session-cardio">
                          <span className="truncate"><Footprints size={13} className="inline-icon" /> {activityLabel(cardio[0].activity)}{workout.distance > 0 ? ` · ${fmtDistance(workout.distance, units)}` : ''}</span>
                          <span className="nowrap muted">{fmtClock(moving)}{workout.distance > 0 && moving > 0 ? ` · ${fmtPace(paceOf(moving, workout.distance), units)}` : ''}</span>
                        </span>
                      )}
                      <span className="session-lines">
                        {groups.map((group) => (
                          <span key={String(group.exerciseId)} className="session-line">
                            <span className="truncate">
                              {exerciseName(exercises, group.exerciseId)} <span className="muted">× {group.sets}</span>
                              {prs?.has(String(group.exerciseId)) && <Trophy size={12} className="inline-trophy" aria-label="Personal record" />}
                            </span>
                            <span className="nowrap muted">{group.best.seconds ? fmtSpan(group.best.seconds) : `${group.best.weight ? fmtWeight(group.best.weight, units) : 'BW'} × ${group.best.reps}`}{group.best.rpe ? ` @${group.best.rpe}` : ''}</span>
                          </span>
                        ))}
                      </span>
                    </button>
                    {workout.routePreview?.length > 1 && <RouteThumb path={workout.routePreview} />}
                    <OverflowMenu
                      label="Session actions"
                      items={[
                        ...(isActivity ? [{ label: 'View', icon: <MapPinned size={16} />, onSelect: () => onOpenActivity(workout) }] : []),
                        ...(workout.sets?.length || !isActivity ? [{ label: 'Edit sets', icon: <Pencil size={16} />, onSelect: () => onEditWorkout(workout) }] : []),
                        ...(workout.sets?.length ? [{ label: 'Repeat today', icon: <Repeat size={16} />, onSelect: () => onRepeatWorkout(workout) }] : []),
                        { label: 'Delete', icon: <Trash2 size={16} />, danger: true, onSelect: () => onDeleteWorkout(workout.id) }
                      ]}
                    />
                  </div>
                );
              })}
              {workouts.length > limit && <button className="btn-ghost" type="button" onClick={() => setLimit(limit + PAGE)} style={{ justifySelf: 'center' }}>Show older sessions</button>}
              {!workouts.length && <EmptyState title="No workouts yet">Start a plan or a free run, or log a past session — Progress lights up straight away.</EmptyState>}
            </div>
          </section>
        </div>

        <div className="layout-aside">
          <section className="card panel stack">
            <CardTitle icon={MapPinned} action={<button className="btn-ghost" type="button" onClick={onPlanRoute}><Plus size={16} /> Plan a route</button>}>Routes</CardTitle>
            {routes.length ? (
              <div className="list">
                {routes.map((route) => (
                  <div key={route.id} className="list-row route-row">
                    <button type="button" className="route-row-main" onClick={() => onEditRoute(route)}>
                      <RouteThumb path={route.path} />
                      <span className="route-row-copy"><strong className="truncate">{route.name}</strong><span className="muted">{fmtDistance(route.distance, units)}</span></span>
                    </button>
                    <button type="button" className="btn-icon" aria-label={`Run ${route.name}`} title="Run this route" onClick={() => onRunRoute(route)}><Play size={17} /></button>
                    <OverflowMenu label={`${route.name} actions`} items={[
                      { label: 'Run this route', icon: <Play size={16} />, onSelect: () => onRunRoute(route) },
                      { label: 'Edit', icon: <Pencil size={16} />, onSelect: () => onEditRoute(route) },
                      { label: 'Delete', icon: <Trash2 size={16} />, danger: true, onSelect: () => onDeleteRoute(route.id) }
                    ]} />
                  </div>
                ))}
              </div>
            ) : <EmptyState title="No routes yet">Draw a loop on the map, then run it with the route on screen.</EmptyState>}
          </section>

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
                <div className="exercise-library-summary" aria-live="polite">
                  <span><strong>{filteredLibrary.length}</strong> match{filteredLibrary.length === 1 ? '' : 'es'}</span>
                  {libraryHasFilters && <button type="button" className="btn-link" onClick={resetLibrary}>Clear filters</button>}
                </div>
                <label className="exercise-library-equipment"><span className="sr-only">Equipment</span><select className="input compact-select" aria-label="Filter library by equipment" value={libraryEquipment} onChange={updateLibraryFilter(setLibraryEquipment)}>
                  <option value="all">All equipment</option>
                  {EXERCISE_EQUIPMENT.filter((item) => item !== 'other').map((item) => <option key={item} value={item}>{equipmentLabel(item)}</option>)}
                </select></label>
              </div>
            </div>
            <div className="exercise-library-results">
              {visibleLibrary.map((exercise) => (
                <article key={exercise.id} className="exercise-library-item">
                  <div className="exercise-library-item-heading"><strong>{exercise.name}</strong>{exercise.type && exercise.type !== 'strength' && <span className="library-type">{muscleLabel(exercise.type)}</span>}</div>
                  <div className="exercise-library-meta">
                    <span className="library-tag library-tag-category">{categoryLabel(categoryForExercise(exercise))}</span>
                    <span className="library-tag">{equipmentLabel(exercise.equipment)}</span>
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
    </main>
  );
}
