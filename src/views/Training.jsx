import { createElement } from 'react';
import { BarChart3, Dumbbell, Target } from 'lucide-react';
import Goals from './Goals.jsx';
import Progress from './Progress.jsx';
import Workouts from './Workouts.jsx';

const SECTIONS = [
  { id: 'workouts', label: 'Workouts', icon: Dumbbell },
  { id: 'progress', label: 'Progress', icon: BarChart3 },
  { id: 'goals', label: 'Goals', icon: Target }
];

export default function Training({
  section = 'workouts', onSectionChange,
  workouts, exercises, units, today, onAddWorkout, onRepeatWorkout, onEditWorkout, onDeleteWorkout, workoutProps = {},
  muscleVolume, bodyweightLogs, dailyTotals, profile, photos, onLogBodyweight, onDeleteBodyweight, onApplyCalories, onAddPhoto, onDeletePhoto,
  goals, goalData, onAddGoal, onEditGoal, onDeleteGoal
}) {
  const activeSection = SECTIONS.some((item) => item.id === section) ? section : 'workouts';

  return (
    <div className="training-shell">
      <div className="training-tabs card" role="tablist" aria-label="Training sections">
        {SECTIONS.map(({ id, label, icon }) => (
          <button key={id} type="button" role="tab" aria-selected={activeSection === id} className={`training-tab ${activeSection === id ? 'active' : ''}`} onClick={() => onSectionChange(id)}>
            {createElement(icon, { size: 17, 'aria-hidden': true })} {label}
          </button>
        ))}
      </div>

      {activeSection === 'workouts' && (
        <Workouts
          workouts={workouts}
          exercises={exercises}
          units={units}
          today={today}
          onAddWorkout={onAddWorkout}
          onRepeatWorkout={onRepeatWorkout}
          onEditWorkout={onEditWorkout}
          onDeleteWorkout={onDeleteWorkout}
          {...workoutProps}
        />
      )}
      {activeSection === 'progress' && (
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
      {activeSection === 'goals' && (
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
    </div>
  );
}
