import { createElement, useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Apple, BarChart3, Dumbbell, Goal, Home, Menu, Settings as SettingsIcon, Soup, X } from 'lucide-react';
import BarcodeScanner from './components/BarcodeScanner.jsx';
import { BodyweightModal, ExerciseModal, FoodModal, FoodPickerModal, GoalModal, LogFoodModal, ProfileModal, WorkoutModal } from './components/Modals.jsx';
import { useDialog } from './components/useDialog.jsx';
import { IconButton } from './components/ui.jsx';
import { SEEDED_EXERCISES } from './data/exercises.js';
import * as data from './db.js';
import { resolveBarcode } from './foodApi.js';
import Dashboard from './views/Dashboard.jsx';
import Foods from './views/Foods.jsx';
import Goals from './views/Goals.jsx';
import LogFood from './views/LogFood.jsx';
import Progress from './views/Progress.jsx';
import Settings from './views/Settings.jsx';
import Workouts from './views/Workouts.jsx';

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: Home },
  { id: 'logFood', label: 'Log Food', icon: Soup },
  { id: 'workouts', label: 'Workouts', icon: Dumbbell },
  { id: 'progress', label: 'Progress', icon: BarChart3 },
  { id: 'goals', label: 'Goals', icon: Goal },
  { id: 'foods', label: 'Foods', icon: Apple },
  { id: 'settings', label: 'Settings', icon: SettingsIcon }
];

function ShellNav({ view, setView, closeMenu = () => {} }) {
  return (
    <nav className="nav-list" aria-label="Primary navigation">
      {NAV.map(({ id, label, icon }) => (
        <button
          key={id}
          className={`nav-item ${view === id ? 'active' : ''}`}
          type="button"
          onClick={() => {
            setView(id);
            closeMenu();
          }}
        >
          {createElement(icon, { size: 18 })} {label}
        </button>
      ))}
    </nav>
  );
}

function Sidebar({ view, setView }) {
  return (
    <aside className="sidebar glass">
      <div className="brand">
        <div className="brand-mark">FF</div>
        <div>
          <strong>Finesse Fit</strong>
          <div className="muted">Local-first tracker</div>
        </div>
      </div>
      <ShellNav view={view} setView={setView} />
      <div style={{ marginTop: 'auto' }} className="muted">Offline-ready after first load</div>
    </aside>
  );
}

function MobileNav({ view, setView }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="mobile-topbar glass split">
        <div className="brand">
          <div className="brand-mark">FF</div>
          <strong>Finesse Fit</strong>
        </div>
        <IconButton label={open ? 'Close menu' : 'Open menu'} onClick={() => setOpen(!open)}>{open ? <X size={19} /> : <Menu size={19} />}</IconButton>
      </div>
      {open && <div className="mobile-menu glass-strong"><ShellNav view={view} setView={setView} closeMenu={() => setOpen(false)} /></div>}
    </>
  );
}

export default function App() {
  const [view, setView] = useState('dashboard');
  const [modal, setModal] = useState(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const { confirm, alert, prompt, Dialog } = useDialog();

  const loadedProfile = useLiveQuery(data.getProfile, [], undefined);
  const profile = loadedProfile ?? data.DEFAULT_PROFILE;
  const foods = useLiveQuery(data.getFoods, [], []);
  const foodLogs = useLiveQuery(data.getFoodLogs, [], []);
  const dailyTotals = useLiveQuery(data.getDailyTotals, [], []);
  const customExercises = useLiveQuery(data.getCustomExercises, [], []);
  const workouts = useLiveQuery(data.getWorkouts, [], []);
  const muscleVolume = useLiveQuery(data.getMuscleVolume, [], []);
  const bodyweightLogs = useLiveQuery(data.getBodyweightLogs, [], []);
  const goals = useLiveQuery(data.getGoals, [], []);
  const exercises = useMemo(() => [...SEEDED_EXERCISES, ...customExercises], [customExercises]);

  useEffect(() => {
    const systemLight = window.matchMedia?.('(prefers-color-scheme: light)').matches;
    const theme = profile.themeMode === 'system' ? (systemLight ? 'light' : 'dark') : profile.themeMode;
    document.documentElement.dataset.theme = theme || 'dark';
  }, [profile.themeMode]);

  useEffect(() => {
    if (loadedProfile === null) data.saveProfile(data.DEFAULT_PROFILE);
  }, [loadedProfile]);

  useEffect(() => {
    if (loadedProfile && loadedProfile.onboarded !== true && !modal) setModal({ type: 'profile', onboarding: true });
  }, [loadedProfile, modal]);

  const closeModal = () => setModal(null);

  const saveFood = async (food) => {
    let saved = food;
    if (modal?.food?.id) await data.updateFood(modal.food.id, food);
    else {
      const id = await data.addFood(food);
      saved = { ...food, id };
    }
    if (modal?.logAfterSave) setModal({ type: 'logFood', food: saved });
    else closeModal();
  };

  const saveFoodLog = async (log) => {
    if (modal?.log?.id) await data.updateFoodLog(modal.log.id, log);
    else await data.addFoodLog(log);
    closeModal();
  };

  const deleteFoodLog = async (id) => {
    if (await confirm('Delete this food log? Daily totals will be adjusted.')) {
      await data.deleteFoodLog(id);
      closeModal();
    }
  };

  const saveWorkout = async (workout) => {
    if (modal?.workout?.id) await data.updateWorkout(modal.workout.id, workout, exercises);
    else await data.addWorkout(workout, exercises);
    closeModal();
  };

  const deleteWorkout = async (id) => {
    if (await confirm('Delete this workout? Muscle volume will be adjusted.')) {
      await data.deleteWorkout(id);
      return true;
    }
    return false;
  };

  const saveGoal = async (goal) => {
    if (modal?.goal?.id) await data.updateGoal(modal.goal.id, goal);
    else await data.addGoal(goal);
    closeModal();
  };

  const handleScan = async (code) => {
    setScannerOpen(false);
    const food = await resolveBarcode(code);
    if (food) setModal({ type: 'logFood', food });
    else setModal({ type: 'food', barcode: code, logAfterSave: true });
  };

  const handleExport = async () => {
    const exported = await data.exportData();
    const blob = new Blob([JSON.stringify(exported, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `finesse-fit-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (file) => {
    try {
      const parsed = JSON.parse(await file.text());
      const replace = await confirm('Replace existing data? Choose OK for replace, Cancel for merge.', 'Import backup');
      await data.importData(parsed, replace ? 'replace' : 'merge');
      await alert('Import complete.');
    } catch (error) {
      await alert(`Import failed: ${error.message}`);
    }
  };

  const clearAll = async () => {
    const typed = await prompt('Type RESET to clear all Finesse Fit data.', 'Full reset', 'RESET');
    if (typed === 'RESET') await data.clearAllData();
  };

  const viewProps = { profile, foods, foodLogs, dailyTotals, workouts, muscleVolume, bodyweightLogs, goals, exercises };

  return (
    <div className="app-shell">
      <Sidebar view={view} setView={setView} />
      <div className="page">
        <MobileNav view={view} setView={setView} />
        {view === 'dashboard' && <Dashboard {...viewProps} onSetView={setView} onProfile={() => setModal({ type: 'profile' })} />}
        {view === 'logFood' && (
          <LogFood
            {...viewProps}
            onScan={() => setScannerOpen(true)}
            onPickFood={(food) => setModal({ type: 'logFood', food })}
            onAddFood={() => setModal({ type: 'food' })}
            onEditLog={(log) => setModal({ type: 'logFood', log, food: foods.find((food) => food.id === log.foodId) ?? { id: log.foodId, name: log.foodName, brand: log.brand, ...(log.foodSnapshot ?? {}) } })}
          />
        )}
        {view === 'foods' && (
          <Foods
            foods={foods}
            onAdd={() => setModal({ type: 'food' })}
            onEdit={(food) => setModal({ type: 'food', food })}
            onDelete={async (id) => (await confirm('Delete this food? Historical logs keep their frozen nutrition.')) && data.deleteFood(id)}
          />
        )}
        {view === 'workouts' && (
          <Workouts
            workouts={workouts}
            exercises={exercises}
            units={profile.units}
            onAddWorkout={() => setModal({ type: 'workout' })}
            onEditWorkout={(workout) => setModal({ type: 'workout', workout })}
            onDeleteWorkout={deleteWorkout}
            onAddExercise={() => setModal({ type: 'exercise' })}
          />
        )}
        {view === 'progress' && <Progress {...viewProps} units={profile.units} onLogBodyweight={() => setModal({ type: 'bodyweight' })} />}
        {view === 'goals' && (
          <Goals
            goals={goals}
            data={{ workouts, muscleVolume, dailyTotals, bodyweightLogs }}
            onAdd={() => setModal({ type: 'goal' })}
            onEdit={(goal) => setModal({ type: 'goal', goal })}
            onDelete={async (id) => (await confirm('Delete this goal?')) && data.deleteGoal(id)}
          />
        )}
        {view === 'settings' && <Settings profile={profile} onProfile={() => setModal({ type: 'profile' })} onProfileChange={(patch) => data.saveProfile({ ...profile, ...patch })} onExport={handleExport} onImport={handleImport} onClear={clearAll} />}
      </div>

      {scannerOpen && <BarcodeScanner onDetected={handleScan} onClose={() => setScannerOpen(false)} />}
      {modal?.type === 'profile' && <ProfileModal profile={profile} onboarding={modal.onboarding} onClose={closeModal} onSave={(next) => data.saveProfile(next).then(closeModal)} />}
      {modal?.type === 'foodPicker' && <FoodPickerModal foods={foods} onClose={closeModal} onPick={(food) => setModal({ type: 'logFood', food })} onAdd={() => setModal({ type: 'food' })} />}
      {modal?.type === 'food' && <FoodModal food={modal.food} barcode={modal.barcode} onClose={closeModal} onSave={saveFood} />}
      {modal?.type === 'logFood' && <LogFoodModal food={modal.food} log={modal.log} onClose={closeModal} onSave={saveFoodLog} onDelete={deleteFoodLog} />}
      {modal?.type === 'exercise' && <ExerciseModal exercise={modal.exercise} onClose={closeModal} onSave={(exercise) => data.addExercise(exercise).then(closeModal)} />}
      {modal?.type === 'workout' && <WorkoutModal workout={modal.workout} exercises={exercises} units={profile.units} onClose={closeModal} onSave={saveWorkout} onDelete={async (id) => { if (await deleteWorkout(id)) closeModal(); }} />}
      {modal?.type === 'goal' && <GoalModal goal={modal.goal} exercises={exercises} onClose={closeModal} onSave={saveGoal} />}
      {modal?.type === 'bodyweight' && <BodyweightModal units={profile.units} onClose={closeModal} onSave={(row) => data.addBodyweightLog(row).then(closeModal)} />}
      {Dialog}
    </div>
  );
}
