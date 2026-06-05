import { Dumbbell, Edit3, Plus, Trash2 } from 'lucide-react';
import { CardTitle, EmptyState, IconButton } from '../components/ui.jsx';
import { exerciseName, fmtWeight } from '../utils.js';

export default function Workouts({ workouts, exercises, units, onAddWorkout, onEditWorkout, onDeleteWorkout, onAddExercise }) {
  return (
    <main className="page">
      <div className="split">
        <div>
          <h1 className="font-display page-title">Workouts</h1>
          <p className="secondary">Rapid set logging with frozen per-muscle attribution.</p>
        </div>
        <div className="row">
          <button className="btn-secondary" type="button" onClick={onAddExercise}><Plus size={18} /> Exercise</button>
          <button className="btn-primary" type="button" onClick={onAddWorkout}><Dumbbell size={18} /> Log workout</button>
        </div>
      </div>
      <section className="glass panel stack">
        <CardTitle icon={Dumbbell}>Sessions</CardTitle>
        <div className="list">
          {workouts.map((workout) => (
            <div key={workout.id} className="list-row stack">
              <div className="split">
                <strong>{workout.date.slice(0, 10)}</strong>
                <div className="row">
                  <span className="muted">{workout.sets?.length ?? 0} sets</span>
                  <IconButton label="Edit workout" onClick={() => onEditWorkout(workout)}><Edit3 size={17} /></IconButton>
                  <IconButton label="Delete workout" onClick={() => onDeleteWorkout(workout.id)}><Trash2 size={17} /></IconButton>
                </div>
              </div>
              <div className="list">
                {(workout.sets ?? []).slice(0, 5).map((set, index) => (
                  <div key={index} className="split secondary">
                    <span>{exerciseName(exercises, set.exerciseId)}</span>
                    <span>{set.reps} reps · {fmtWeight(set.weight, units)}{set.rpe ? ` · RPE ${set.rpe}` : ''}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {!workouts.length && <EmptyState title="No workouts yet">Add a few sets and Progress will light up immediately.</EmptyState>}
        </div>
      </section>
    </main>
  );
}
