import { BarChart3, Dumbbell, Plus, Target } from 'lucide-react';

import { PageHeader, Tabs } from '../components/ui.jsx';
import Goals from './Goals.jsx';
import Progress from './Progress.jsx';
import Workouts from './Workouts.jsx';

/**
 * Training is a consolidated page: Workouts, Progress and Goals were three nav
 * entries and are now three tabs under one.
 *
 * The page header lives *here* rather than in each panel. Three panels each
 * drawing their own title under a tab strip that already names them says the
 * same word twice and pushes the content down by two rows on the screen with
 * the least of it to spare — so the header stays put and only its subtitle and
 * primary action change with the tab.
 */
const SECTIONS = [
  {
    id: 'workouts',
    label: 'Workouts',
    Icon: Dumbbell,
    subtitle: 'Tap a session to edit it. Muscle volume is frozen when you save.',
    action: 'Log workout',
  },
  {
    id: 'progress',
    label: 'Progress',
    Icon: BarChart3,
    subtitle: 'Muscle volume, strength curves, nutrition adherence and bodyweight trends.',
    action: 'Log bodyweight',
  },
  {
    id: 'goals',
    label: 'Goals',
    Icon: Target,
    subtitle: 'Strength, bodyweight, weekly volume and nutrition targets.',
    action: 'Add goal',
  },
];

export default function Training({
  section = 'workouts', onSectionChange,
  workouts, exercises, units, today, onAddWorkout, onRepeatWorkout, onEditWorkout, onDeleteWorkout,
  muscleVolume, bodyweightLogs, dailyTotals, profile, photos, onLogBodyweight, onDeleteBodyweight, onApplyCalories, onAddPhoto, onDeletePhoto,
  goals, goalData, onAddGoal, onEditGoal, onDeleteGoal
}) {
  const active = SECTIONS.find((item) => item.id === section) ?? SECTIONS[0];
  const primaryAction = { workouts: onAddWorkout, progress: onLogBodyweight, goals: onAddGoal }[active.id];

  return (
    <>
      <PageHeader eyebrow="Training" title={active.label} subtitle={active.subtitle}>
        <button className="btn-primary" type="button" onClick={primaryAction}>
          <Plus size={18} aria-hidden="true" /> {active.action}
        </button>
      </PageHeader>

      <Tabs label="Training sections" tabs={SECTIONS} value={active.id} onChange={onSectionChange} />

      {active.id === 'workouts' && (
        <Workouts
          workouts={workouts}
          exercises={exercises}
          units={units}
          today={today}
          onAddWorkout={onAddWorkout}
          onRepeatWorkout={onRepeatWorkout}
          onEditWorkout={onEditWorkout}
          onDeleteWorkout={onDeleteWorkout}
        />
      )}
      {active.id === 'progress' && (
        <Progress
          muscleVolume={muscleVolume}
          workouts={workouts}
          exercises={exercises}
          bodyweightLogs={bodyweightLogs}
          dailyTotals={dailyTotals}
          profile={profile}
          units={units}
          today={today}
          photos={photos}
          onLogBodyweight={onLogBodyweight}
          onDeleteBodyweight={onDeleteBodyweight}
          onApplyCalories={onApplyCalories}
          onAddPhoto={onAddPhoto}
          onDeletePhoto={onDeletePhoto}
        />
      )}
      {active.id === 'goals' && (
        <Goals
          goals={goals}
          exercises={exercises}
          units={units}
          data={goalData}
          onAdd={onAddGoal}
          onEdit={onEditGoal}
          onDelete={onDeleteGoal}
        />
      )}
    </>
  );
}
