import { useState } from 'react';
import { Apple, Barcode, Bot, BookmarkPlus, CalendarCheck, CopyPlus, Download, Droplets, Dumbbell, Plus, Scale, ShieldAlert, Sparkles, Target, X } from 'lucide-react';
import { AiContextModal } from '../components/Modals.jsx';
import { CardTitle, EmptyState, IconButton, PageHeader } from '../components/ui.jsx';
import StatRing from '../components/StatRing.jsx';
import WeekReview from '../components/WeekReview.jsx';
import { MUSCLES } from '../data/exercises.js';
import { fmtDistance } from '../geo.js';
import { formatNutrientAmount, MICRONUTRIENTS } from '../micronutrients.js';
import { buildAiContext, EXTRA_NUTRIENTS, GOAL_STATUS, backupReminder, dateKey, fmtCalories, fmtCompact, fmtDate, fmtWeight, goalProgress, groupLogsByMeal, mealLabel, muscleLabel, neglectedMuscles, percent, shiftDay, shiftWeekKey, weekDays, weekKey, weekLabel, weeklyReview, weightRatePerWeek, weightTrend } from '../utils.js';

function LedgerRow({ label, value, target, unit, color }) {
  const pct = percent(value, target);
  const over = pct > 110;
  return (
    <div className="ledger-row">
      <span className="eyebrow">{label}</span>
      <div className="progress-track thin"><div className={`progress-fill ${over ? 'over' : ''}`} style={{ '--value': `${Math.min(100, pct)}%`, '--bar': color }} /></div>
      <span className="metric ledger-value">{Math.round(value ?? 0)}<span className="ledger-unit">/{Math.round(target)}{unit}</span></span>
    </div>
  );
}

function HeroNutrition({ totals, targets }) {
  const calPct = percent(totals.calories ?? 0, targets.calories);
  const remaining = Math.round((targets.calories ?? 0) - (totals.calories ?? 0));
  const over = remaining < 0;
  return (
    <section className="card hero">
      <div className="hero-ring">
        <StatRing pct={calPct} size={168} thickness={13} over={over} />
        <div className="hero-ring-center">
          <span className="eyebrow">{over ? 'Over target' : 'Calories left'}</span>
          <div className="hero-num">{Math.abs(remaining).toLocaleString()}</div>
          <span className="muted">of {fmtCalories(targets.calories)}</span>
        </div>
      </div>
      <div className="ledger">
        <LedgerRow label="Protein" value={totals.protein} target={targets.protein} unit="g" color="var(--accent-2)" />
        <LedgerRow label="Carbs" value={totals.carbs} target={targets.carbs} unit="g" color="var(--accent-3)" />
        <LedgerRow label="Fat" value={totals.fat} target={targets.fat} unit="g" color="var(--accent-4)" />
      </div>
    </section>
  );
}

function formatWater(ml) {
  return ml >= 1000 ? `${Number((ml / 1000).toFixed(2))} L` : `${Math.round(ml).toLocaleString()} ml`;
}

function WaterTracker({ logs, today, targetMl, onAddWater, onCustomWater, onEditGoal, onDelete }) {
  const todayLogs = logs.filter((log) => log.date === today).sort((a, b) => (b.loggedAt ?? '').localeCompare(a.loggedAt ?? '') || b.id - a.id);
  const total = todayLogs.reduce((sum, log) => sum + (Number(log.ml) || 0), 0);
  const target = Number(targetMl) > 0 ? Number(targetMl) : null;
  const progress = target ? Math.min(100, total / target * 100) : 0;

  return (
    <section className="card panel stack">
      <CardTitle icon={Droplets} action={<button className="btn-ghost" type="button" onClick={onEditGoal}>{target ? 'Edit goal' : 'Set goal'}</button>}>
        Water
      </CardTitle>
      <div className="split">
        <strong className="metric">{formatWater(total)}</strong>
        {target && <span className="muted">of {formatWater(target)}</span>}
      </div>
      {target ? (
        <div className="progress-track thin" role="progressbar" aria-label="Water intake against your daily goal" aria-valuemin="0" aria-valuemax={target} aria-valuenow={Math.min(total, target)} aria-valuetext={`${formatWater(total)} of ${formatWater(target)}`}>
          <div className="progress-fill" style={{ '--value': `${progress}%`, '--bar': 'var(--info)' }} />
        </div>
      ) : <span className="muted">Set your own daily target to see progress.</span>}
      <div className="row" style={{ flexWrap: 'wrap' }}>
        <button className="btn-secondary" type="button" onClick={() => onAddWater(250)}>+250 ml</button>
        <button className="btn-secondary" type="button" onClick={() => onAddWater(500)}>+500 ml</button>
        <button className="btn-ghost" type="button" onClick={onCustomWater}><Plus size={16} /> Custom</button>
      </div>
      {todayLogs.length > 0 && (
        <details className="stack" style={{ gap: 'var(--gap-sm)' }}>
          <summary className="meal-heading">Entries ({todayLogs.length})</summary>
          <div className="list">
            {todayLogs.map((log) => (
              <div className="list-row" key={log.id}>
                <div className="list-main">
                  <strong>{formatWater(Number(log.ml) || 0)}</strong>
                  <span className="muted">{log.loggedAt ? new Date(log.loggedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'Logged today'}</span>
                </div>
                <IconButton label={`Delete ${formatWater(Number(log.ml) || 0)} water entry`} onClick={() => onDelete(log.id)}><X size={16} /></IconButton>
              </div>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}

function MicronutrientTracker({ totals, hasData, onAddFood }) {
  const row = ({ key, label, unit, target }) => {
    const value = Number(totals[key]) || 0;
    const tracked = Number(totals.micronutrientCounts?.[key]) > 0 || value > 0;
    const pct = tracked ? Math.min(100, (value / target) * 100) : 0;
    return (
      <div key={key} className="ledger-row">
        <span className="eyebrow" title={label}>{label}</span>
        <div className="progress-track thin" role="progressbar" aria-label={`${label} of adult label reference`} aria-valuetext={tracked ? `${formatNutrientAmount(value)} ${unit} of ${formatNutrientAmount(target)} ${unit}` : 'No food data'} aria-valuemin="0" aria-valuemax={target} aria-valuenow={Math.min(value, target)}>
          <div className="progress-fill" style={{ '--value': `${pct}%`, '--bar': 'var(--accent-2)' }} />
        </div>
        <span className="metric ledger-value">{tracked ? formatNutrientAmount(value) : '—'}<span className="ledger-unit">/{formatNutrientAmount(target)} {unit}</span></span>
      </div>
    );
  };
  const groups = (nutrients) => ['Vitamins', 'Minerals'].map((group) => (
    <div key={group} className="meal-group">
      <span className="meal-heading">{group}</span>
      <div className="list">{nutrients.filter((nutrient) => nutrient.group === group).map(row)}</div>
    </div>
  ));

  return (
    <section className="card panel stack">
      <CardTitle icon={Sparkles} action={<button className="btn-ghost" type="button" onClick={onAddFood}><Plus size={16} /> Log food</button>}>
        Micronutrients
      </CardTitle>
      <span className="muted">
        Daily intake · <a href="https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32011R1169" target="_blank" rel="noreferrer">EU adult label references</a>
      </span>
      {groups(MICRONUTRIENTS.filter(({ featured }) => featured))}
      <details className="stack" style={{ gap: 'var(--gap-sm)' }}>
        <summary className="meal-heading">More vitamins and minerals ({MICRONUTRIENTS.filter(({ featured }) => !featured).length})</summary>
        {groups(MICRONUTRIENTS.filter(({ featured }) => !featured))}
      </details>
      <span className="muted">
        {hasData
          ? 'Only values supplied with food data are counted; missing amounts are unknown, not zero.'
          : 'Add micronutrient values to foods when available. These general references are not personalised targets.'}
      </span>
    </section>
  );
}

export default function Dashboard({ profile, foodLogs, dailyTotals, workouts, muscleVolume, goals, bodyweightLogs, waterLogs, exercises, today, onSetView, onScan, onEditLog, onAddWorkout, onProfile, onSaveMeal, onCopyLogs, onExport, onSnoozeBackup, onDismissReview, onAddWater, onCustomWater, onEditWaterGoal, onDeleteWater }) {
  const [aiContextOpen, setAiContextOpen] = useState(false);
  const totals = dailyTotals.find((row) => row.date === today) ?? {};
  const todayLogs = foodLogs.filter((log) => dateKey(log.date) === today);
  const todayWorkouts = workouts.filter((workout) => dateKey(workout.date) === today);
  const meals = groupLogsByMeal(todayLogs);
  const yesterday = shiftDay(today, -1);
  const yesterdayMeals = groupLogsByMeal(foodLogs.filter((log) => dateKey(log.date) === yesterday));
  const firstActivityDate = [dailyTotals[0]?.date, bodyweightLogs[0]?.date, waterLogs.at(-1)?.date, workouts.at(-1)?.date].filter(Boolean).map((date) => dateKey(date)).sort()[0];
  const backup = backupReminder({ lastExportAt: profile.lastExportAt, snoozedUntil: profile.backupSnoozedUntil, firstActivityDate, today });
  const week = weekKey(today);
  const weekVolume = muscleVolume.filter((row) => row.weekKey === week).reduce((sum, row) => sum + row.volume, 0);
  const weekSessions = workouts.filter((workout) => weekKey(workout.date) === week);
  const weekSets = weekSessions.reduce((sum, workout) => sum + (workout.sets?.length ?? 0), 0);
  const weekDistance = weekSessions.reduce((sum, workout) => sum + (workout.distance ?? 0), 0);
  const lastWorkout = workouts[0];
  const latestWeight = bodyweightLogs.at(-1);
  const trend = weightTrend(bodyweightLogs).at(-1)?.trend;
  const rate = weightRatePerWeek(bodyweightLogs, { today });
  const neglected = neglectedMuscles(MUSCLES, workouts, { today }).slice(0, 3);
  const extras = EXTRA_NUTRIENTS.filter(({ key }) => (totals[key] ?? 0) > 0);
  // Show last week's review early in the new week (Mon–Wed) until dismissed.
  const lastWeek = shiftWeekKey(week, -1);
  const review = weekDays(week).indexOf(today) <= 2 && profile.reviewDismissedWeek !== lastWeek
    ? weeklyReview({ week: lastWeek, dailyTotals, workouts, muscleVolume, bodyweightLogs, profile })
    : null;
  const goalData = { workouts, muscleVolume, dailyTotals, bodyweightLogs, profile };
  const isNew = !foodLogs.length && !workouts.length && !goals.length && !waterLogs.length;

  const lastSessionNames = lastWorkout ? [...new Set(lastWorkout.sets?.map((set) => exercises.find((item) => String(item.id) === String(set.exerciseId))?.name).filter(Boolean))] : [];
  const repeatable = yesterdayMeals.filter((group) => !meals.some((item) => item.meal === group.meal));

  return (
    <main className="page">
      <PageHeader title="Today" subtitle={fmtDate(today, 'EEEE d MMMM')}>
        <button className="btn-secondary" type="button" onClick={() => setAiContextOpen(true)}><Bot size={18} /> AI context</button>
        <button className="btn-secondary" type="button" onClick={onScan}><Barcode size={18} /> Scan</button>
        <button className="btn-primary" type="button" onClick={() => onSetView('logFood')}><Plus size={18} /> Log food</button>
      </PageHeader>

      {backup && (
        <section className="card panel banner warn" role="status">
          <ShieldAlert size={20} aria-hidden="true" />
          <div className="banner-text">
            <strong>{backup.neverExported ? 'Back up your data' : `Last backup was ${backup.days} days ago`}</strong>
            <span className="muted">
              {backup.neverExported ? `${backup.days} days of history only exist in this browser.` : 'Everything since then only exists in this browser.'}
            </span>
          </div>
          <div className="row banner-actions">
            <button className="btn-ghost" type="button" onClick={onSnoozeBackup}>Later</button>
            <button className="btn-primary" type="button" onClick={onExport}><Download size={18} /> Export</button>
          </div>
        </section>
      )}

      {isNew && (
        <section className="card panel stack welcome">
          <CardTitle icon={Sparkles}>Welcome to Finesse Fit</CardTitle>
          <p className="secondary" style={{ margin: 0 }}>Three quick steps to get going. Everything stays on this device and works offline.</p>
          <div className="row">
            <button className="btn-secondary" type="button" onClick={onProfile}>1 · Review targets</button>
            <button className="btn-secondary" type="button" onClick={onScan}>2 · Log a meal</button>
            <button className="btn-secondary" type="button" onClick={onAddWorkout}>3 · Log a workout</button>
          </div>
        </section>
      )}

      <HeroNutrition totals={totals} targets={profile.targets} />

      {review && !review.isEmpty && (
        <section className="card panel stack">
          <CardTitle icon={CalendarCheck} action={<IconButton label="Dismiss weekly review" className="btn-icon btn-icon-quiet" onClick={() => onDismissReview(lastWeek)}><X size={17} /></IconButton>}>
            Last week <span className="muted title-meta">{weekLabel(lastWeek)}</span>
          </CardTitle>
          <WeekReview review={review} units={profile.units} />
        </section>
      )}

      <div className="layout-split">
        <div className="layout-main">
          <section className="card panel stack">
            <CardTitle icon={Apple} action={<span className="title-meta">{fmtCalories(totals.calories ?? 0)}</span>}>Meals</CardTitle>
            {meals.length ? meals.map(({ meal, logs }) => (
              <div key={meal} className="meal-group">
                <div className="split meal-heading">
                  <span>{mealLabel(meal)}</span>
                  <span className="row" style={{ gap: 2, flexWrap: 'nowrap' }}>
                    {fmtCalories(logs.reduce((sum, log) => sum + (log.computed?.calories ?? 0), 0))}
                    <IconButton label={`Save ${mealLabel(meal).toLowerCase()} as a meal`} className="btn-icon btn-sm" onClick={() => onSaveMeal(meal, logs)}><BookmarkPlus size={15} /></IconButton>
                  </span>
                </div>
                <div className="list">
                  {logs.map((log) => (
                    <button key={log.id} type="button" className="list-row split compact" onClick={() => onEditLog(log)}>
                      <span className="truncate"><strong>{log.foodName}</strong><span className="muted"> · {log.quick ? 'quick add' : `${log.quantity} ${log.unit === 'g' ? 'g' : log.quantity === 1 ? 'serving' : 'servings'}`}</span></span>
                      <span className="nowrap secondary">{fmtCalories(log.computed.calories)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )) : <EmptyState title="Nothing logged yet">Scan or search a food to start the day.</EmptyState>}
            {repeatable.length > 0 && (
              <div className="meal-group">
                <span className="meal-heading">Repeat from yesterday</span>
                <div className="chip-row">
                  {repeatable.map((group) => (
                    <button key={group.meal} type="button" className="chip" onClick={() => onCopyLogs(group.logs, group.meal)}>
                      <CopyPlus size={14} /> {mealLabel(group.meal)} · {fmtCalories(group.calories)}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {extras.length > 0 && (
              <div className="card-footer muted">
                {extras.map(({ key, label }) => <span key={key}>{label} <strong className="secondary">{totals[key]} g</strong></span>)}
              </div>
            )}
          </section>
        </div>

        <div className="layout-aside">
          <WaterTracker
            logs={waterLogs}
            today={today}
            targetMl={profile.waterTargetMl}
            onAddWater={onAddWater}
            onCustomWater={onCustomWater}
            onEditGoal={onEditWaterGoal}
            onDelete={onDeleteWater}
          />
          <MicronutrientTracker
            totals={totals}
            hasData={MICRONUTRIENTS.some(({ key }) => Number(totals.micronutrientCounts?.[key]) > 0 || Number(totals[key]) > 0)}
            onAddFood={() => onSetView('logFood')}
          />
          <section className="card panel stack">
            <CardTitle icon={Dumbbell} action={<button className="btn-ghost" type="button" onClick={onAddWorkout}><Plus size={16} /> Log</button>}>This week</CardTitle>
            <div className="stat-grid tight">
              <div><div className="metric">{weekSessions.length}</div><span className="muted">sessions</span></div>
              <div><div className="metric">{weekSets}</div><span className="muted">sets</span></div>
              <div><div className="metric">{fmtCompact(weekVolume)}</div><span className="muted">volume</span></div>
            </div>
            {(lastWorkout || neglected.length > 0) && (
              <div className="detail-list">
                {weekDistance > 0 && (
                  <div className="detail-row">
                    <span className="muted">Distance this week</span>
                    <span className="truncate">{fmtDistance(weekDistance, profile.units)}</span>
                  </div>
                )}
                {lastWorkout && (
                  <div className="detail-row">
                    <span className="muted">Last session</span>
                    <span className="truncate">{fmtDate(lastWorkout.date, 'EEE d MMM')} · {lastWorkout.name || lastSessionNames.slice(0, 2).join(', ') || `${lastWorkout.sets?.length ?? 0} sets`}{lastWorkout.distance > 0 ? ` · ${fmtDistance(lastWorkout.distance, profile.units)}` : ''}</span>
                  </div>
                )}
                {neglected.length > 0 && (
                  <button type="button" className="detail-row" onClick={() => onSetView('progress')}>
                    <span className="muted">Needs attention</span>
                    <span className="truncate">{neglected.map((row) => muscleLabel(row.muscle)).join(', ')}</span>
                  </button>
                )}
              </div>
            )}
          </section>

          <section className="card panel stack">
            <CardTitle icon={Target} action={<button className="btn-ghost" type="button" onClick={() => onSetView('goals')}>{goals.length ? 'See all' : 'Add'}</button>}>Goals</CardTitle>
            {goals.length ? (
              <div className="list">
                {goals.slice(0, 3).map((goal) => {
                  const progress = goalProgress(goal, goalData);
                  const status = GOAL_STATUS[progress.status];
                  return (
                    <button key={goal.id} type="button" className="list-row goal-mini" onClick={() => onSetView('goals')}>
                      <div className="split"><strong className="truncate">{goal.title}</strong><span className={status.className}>{status.label}</span></div>
                      <div className="progress-track"><div className="progress-fill" style={{ '--value': `${progress.pct}%` }} /></div>
                    </button>
                  );
                })}
              </div>
            ) : <EmptyState title="No goals yet">Track a lift, your bodyweight, weekly volume or nutrition.</EmptyState>}
          </section>

          <section className="card panel stack">
            <CardTitle icon={Scale} action={<button className="btn-ghost" type="button" onClick={() => onSetView('progress')}>Trend</button>}>Bodyweight</CardTitle>
            {latestWeight ? (
              <div className="split" style={{ alignItems: 'flex-end' }}>
                <div>
                  <div className="metric">{fmtWeight(trend ?? latestWeight.weight, profile.units)}</div>
                  <span className="muted">7-day average</span>
                </div>
                {rate != null && (
                  <div style={{ textAlign: 'right' }}>
                    <strong>{rate > 0 ? '+' : rate < 0 ? '−' : '±'}{fmtWeight(Math.abs(rate), profile.units)}</strong>
                    <div className="muted">per week</div>
                  </div>
                )}
              </div>
            ) : <EmptyState title="No weigh-ins yet">Log your bodyweight from Progress to see a trend.</EmptyState>}
          </section>
        </div>
      </div>

      {aiContextOpen && (
        <AiContextModal
          text={buildAiContext({ today, profile, totals, meals, todayWorkouts, exercises, goals, goalData })}
          onClose={() => setAiContextOpen(false)}
        />
      )}
    </main>
  );
}
