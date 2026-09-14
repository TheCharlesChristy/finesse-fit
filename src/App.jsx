import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Apple, Dumbbell, Home, LoaderCircle, Settings as SettingsIcon, Trophy } from 'lucide-react';
import ActivityModal from './components/ActivityModal.jsx';
import AppShell from './components/AppShell.jsx';
import BarcodeScanner from './components/BarcodeScanner.jsx';
import { BodyweightModal, ExerciseModal, FoodModal, GoalModal, LogFoodModal, LogMealModal, ProfileModal, QuickAddModal, WorkoutModal } from './components/Modals.jsx';
import PlanModal from './components/PlanModal.jsx';
import RoutePlannerModal from './components/RoutePlannerModal.jsx';
import ScanLabelModal from './components/ScanLabelModal.jsx';
import WorkoutSession from './components/WorkoutSession.jsx';
import { useDialog } from './components/useDialog.jsx';
import { SEEDED_EXERCISES } from './data/exercise-library/index.js';
import * as data from './db.js';
import { primeAudio } from './cues.js';
import { useAppearance } from './theme/useAppearance.js';
import { resolveBarcode, saveSearchResult, searchFoods } from './foodApi.js';
import { buildGpx, fmtClock, fmtDistance, samplePath, trackDistance, trackLatLngs } from './geo.js';
import { buildPhoto } from './photos.js';
import { normalizePlan } from './plans.js';
import { createSession, resumeSession, sessionPlanUpdate, sessionToWorkout } from './session.js';
import { shareFile, shareJson, SHARE_CANCELLED } from './share.js';
import { getPersistenceState, getStorageEstimate, requestPersistence as requestStoragePersistence, STORAGE_BEST_EFFORT, STORAGE_PERSISTED } from './storage.js';
import { dateKey, exerciseName, findPersonalRecords, fmtCalories, fmtWeight, mealItemsFromLogs, mealLabel, retargetCalories, snoozeUntil } from './utils.js';
import Dashboard from './views/Dashboard.jsx';
import LogFood from './views/LogFood.jsx';
import Settings from './views/Settings.jsx';
import Training from './views/Training.jsx';

const NAV = [
  { id: 'dashboard', label: 'Today', short: 'Today', icon: Home },
  { id: 'logFood', label: 'Food', short: 'Food', icon: Apple },
  { id: 'training', label: 'Training', short: 'Train', icon: Dumbbell },
  { id: 'settings', label: 'Settings', short: 'Settings', icon: SettingsIcon }
];

/**
 * The tabs that used to be their own nav entries, and where they went.
 *
 * Folding Workouts, Progress and Goals into one Training page kept the nav to
 * four entries — but those three ids are still the vocabulary the rest of the
 * app navigates in, so `setView` resolves through here rather than every caller
 * being rewritten. Same pattern, and same reasoning, as Finesse's VIEW_ALIASES.
 */
const VIEW_ALIASES = {
  workouts: ['training', 'workouts'],
  progress: ['training', 'progress'],
  goals: ['training', 'goals']
};

// The one tiny localStorage key both apps allow themselves: a mirror of the
// appearance settings so the first paint uses the right theme. See theme/.
const APPEARANCE_KEY = 'finesse-fit:appearance';

function Toast({ notice, onDismiss }) {
  if (!notice) return null;
  return (
    <div className="toast-stack">
      <div className={`toast card-raised ${notice.icon === 'trophy' ? 'highlight' : notice.tone ?? ''}`.trim()} role="status" aria-live="polite">
        {notice.busy && <LoaderCircle size={18} className="spin" aria-hidden="true" />}
        {notice.icon === 'trophy' && <Trophy size={18} aria-hidden="true" />}
        <span className="toast-text">{notice.message}</span>
        {notice.action && (
          <button type="button" className="toast-action" onClick={() => { onDismiss(); notice.action.onClick(); }}>
            {notice.action.label}
          </button>
        )}
      </div>
    </div>
  );
}

// Re-render when the app comes back to the foreground so "today" rolls over after midnight.
function useToday() {
  const [today, setToday] = useState(dateKey());
  useEffect(() => {
    const refresh = () => setToday(dateKey());
    const timer = window.setInterval(refresh, 60_000);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, []);
  return today;
}

export default function App() {
  const [view, setViewState] = useState('dashboard');
  const [trainingSection, setTrainingSection] = useState('workouts');
  const [modal, setModal] = useState(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanLabelOpen, setScanLabelOpen] = useState(false);
  const [notice, setNotice] = useState(null);
  const noticeTimer = useRef(0);
  const { confirm, alert, prompt, choose, Dialog } = useDialog();
  const today = useToday();

  const loadedProfile = useLiveQuery(data.getProfile, [], undefined);
  const profile = loadedProfile ?? data.DEFAULT_PROFILE;
  const foods = useLiveQuery(data.getFoods, [], []);
  const foodLogs = useLiveQuery(data.getFoodLogs, [], []);
  const dailyTotals = useLiveQuery(data.getDailyTotals, [], []);
  const customExercises = useLiveQuery(data.getCustomExercises, [], []);
  const workouts = useLiveQuery(data.getWorkouts, [], []);
  const muscleVolume = useLiveQuery(data.getMuscleVolume, [], []);
  const bodyweightLogs = useLiveQuery(data.getBodyweightLogs, [], []);
  const progressPhotos = useLiveQuery(data.getProgressPhotos, [], []);
  const goals = useLiveQuery(data.getGoals, [], []);
  const meals = useLiveQuery(data.getMeals, [], []);
  const plans = useLiveQuery(data.getPlans, [], []);
  const routes = useLiveQuery(data.getRoutes, [], []);
  // undefined until loaded, so a stored session can be told apart from "none".
  const activeSessionCount = useLiveQuery(data.hasActiveSession, [], undefined);
  const activityTrack = useLiveQuery(() => data.getTrackForWorkout(modal?.type === 'activity' ? modal.workout.id : null), [modal?.type, modal?.workout?.id]);
  const [session, setSession] = useState(null);
  const [sessionMinimized, setSessionMinimized] = useState(false);
  const pendingQuickStart = useRef(null);
  const [storageState, setStorageState] = useState(null);
  const [storageEstimate, setStorageEstimate] = useState(null);
  const [onlineSearch, setOnlineSearch] = useState(null);
  const searchController = useRef(null);
  const persistAsked = useRef(false);
  const exercises = useMemo(() => [...SEEDED_EXERCISES, ...customExercises], [customExercises]);
  const latestBodyweight = bodyweightLogs.at(-1)?.weight ?? profile.bodyweight;

  const setView = useCallback((next) => {
    const [page, tab] = VIEW_ALIASES[next] ?? [next, null];
    if (tab) setTrainingSection(tab);
    setViewState(page);
    window.scrollTo({ top: 0 });
  }, []);

  const notify = useCallback((message, options = {}) => {
    window.clearTimeout(noticeTimer.current);
    setNotice({ message, ...options });
    if (!options.busy) noticeTimer.current = window.setTimeout(() => setNotice(null), options.duration ?? 2600);
  }, []);

  // Paints <html> from the profile and mirrors it for the next cold start. Held
  // back until the profile has actually loaded, so the boot script's paint
  // stands rather than being overwritten with the defaults for one frame.
  const resolvedTheme = useAppearance(profile.appearance, APPEARANCE_KEY, loadedProfile !== undefined);

  useEffect(() => {
    if (loadedProfile === null) data.saveProfile(data.DEFAULT_PROFILE);
  }, [loadedProfile]);

  useEffect(() => {
    getPersistenceState().then(setStorageState);
    getStorageEstimate().then(setStorageEstimate);
  }, []);

  // Ask the browser not to evict IndexedDB under storage pressure (Safari/Chrome can
  // otherwise clear it). Requested after the user has saved something worth keeping.
  const requestPersistence = useCallback(async () => {
    const state = await requestStoragePersistence();
    setStorageState(state);
    getStorageEstimate().then(setStorageEstimate);
    return state === STORAGE_PERSISTED;
  }, []);

  // Open onboarding at most once per launch: after Save/Skip the live query can
  // still report the old profile for a tick, which would otherwise reopen it.
  const onboardingShown = useRef(false);
  useEffect(() => {
    if (!loadedProfile) return;
    if (loadedProfile.onboarded === true) onboardingShown.current = false;
    else if (!onboardingShown.current && !modal) {
      onboardingShown.current = true;
      setModal({ type: 'profile', onboarding: true });
    }
  }, [loadedProfile, modal]);

  const closeModal = () => setModal(null);

  // Home-screen shortcuts (see manifest `shortcuts`) open the app with ?action=…
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const action = params.get('action');
    if (!action) return;
    window.history.replaceState(null, '', window.location.pathname);
    if (action === 'scan') {
      setViewState('logFood');
      setScannerOpen(true);
    } else if (action === 'workout') {
      setTrainingSection('workouts');
      setViewState('training');
      setModal({ type: 'workout' });
    } else if (action === 'food') {
      setViewState('logFood');
    } else if (action === 'run') {
      setTrainingSection('workouts');
      setViewState('training');
      // Started once we know whether a session is already in progress.
      pendingQuickStart.current = 'run';
    }
  }, []);

  const dismissNotice = useCallback(() => {
    window.clearTimeout(noticeTimer.current);
    setNotice(null);
  }, []);

  // Wraps a DB mutation so failures surface to the user instead of silently leaving a modal open.
  const run = async (task, success) => {
    try {
      const result = await task();
      if (success) notify(success, { tone: 'good' });
      if (storageState === STORAGE_BEST_EFFORT && !persistAsked.current) {
        persistAsked.current = true;
        requestPersistence();
      }
      return result;
    } catch (error) {
      await alert(`Something went wrong: ${error.message}`, 'Couldn’t save');
      return undefined;
    }
  };

  const saveFood = async (food) => {
    let saved = food;
    await run(async () => {
      if (modal?.food?.id) await data.updateFood(modal.food.id, food);
      else saved = { ...food, id: await data.addFood(food) };
      if (modal?.logAfterSave) setModal({ type: 'logFood', food: saved });
      else closeModal();
    }, modal?.logAfterSave ? null : 'Food saved');
  };

  const saveFoodLog = (log) => run(async () => {
    if (modal?.log?.id) await data.updateFoodLog(modal.log.id, log);
    else await data.addFoodLog(log);
    closeModal();
  }, modal?.log?.id ? 'Log updated' : `Logged ${log.computed.calories} kcal`);

  // Deletes happen immediately with an Undo in the toast, instead of an "are you sure?" dialog first.
  const removeWithUndo = async (remove, restore, message) => {
    const removed = await run(remove);
    if (!removed) return false;
    notify(message, { duration: 6000, action: { label: 'Undo', onClick: () => run(() => restore(removed), 'Restored') } });
    return true;
  };

  const deleteFoodLog = async (id) => {
    closeModal();
    await removeWithUndo(() => data.deleteFoodLog(id), data.restoreFoodLog, 'Log deleted');
  };

  const saveQuickLog = (entry) => run(async () => {
    if (modal?.log?.id) await data.updateFoodLog(modal.log.id, { foodName: entry.name, date: entry.date, mealType: entry.mealType, computed: entry.computed });
    else await data.addQuickLog(entry);
    closeModal();
  }, modal?.log?.id ? 'Log updated' : `Logged ${entry.computed.calories} kcal`);

  const saveWorkout = async (workout) => {
    const editingId = modal?.workout?.id;
    const records = findPersonalRecords(workouts, workout.sets, { excludeId: editingId });
    const saved = await run(async () => {
      if (editingId) await data.updateWorkout(editingId, workout, exercises);
      else await data.addWorkout(workout, exercises);
      closeModal();
      return true;
    }, records.length ? null : editingId ? 'Workout updated' : `Workout saved · ${workout.sets.length} sets`);
    if (saved && records.length) {
      const [top] = records;
      const extra = records.length > 1 ? ` +${records.length - 1} more` : '';
      notify(`New PR: ${exerciseName(exercises, top.exerciseId)} ${fmtWeight(top.e1rm, profile.units)} e1RM${extra}`, { tone: 'good', icon: 'trophy', duration: 5000 });
    }
  };

  const closeWorkout = async (dirty) => {
    if (!dirty || await confirm('You have unsaved sets in this workout.', 'Discard workout?', { confirmLabel: 'Discard', danger: true })) closeModal();
  };

  const saveMealFromLogs = async (mealType, logs) => {
    const suggested = logs.length === 1 ? logs[0].foodName : `${mealLabel(mealType)} · ${logs[0].foodName} + ${logs.length - 1}`;
    const name = await prompt(`Save these ${logs.length} ${logs.length === 1 ? 'item' : 'items'} as a meal you can log in one tap.`, 'Save meal', 'Meal name', { confirmLabel: 'Save meal', defaultValue: suggested, autoCapitalize: 'sentences' });
    if (!name?.trim()) return;
    await run(() => data.addMeal({ name: name.trim(), mealType, items: mealItemsFromLogs(logs) }), `Saved “${name.trim()}”`);
  };

  const copyLogs = (logs, mealType) => run(
    () => data.copyFoodLogs(logs, { date: today, mealType }),
    `Copied ${mealLabel(mealType).toLowerCase()} · ${fmtCalories(logs.reduce((sum, log) => sum + (log.computed?.calories ?? 0), 0))}`
  );

  const logMeal = ({ date, mealType }) => run(async () => {
    const count = await data.logMeal(modal.meal.id, { date, mealType });
    closeModal();
    return count;
  }, `Logged ${modal?.meal?.name}`);

  const deleteMeal = async (id) => {
    closeModal();
    await removeWithUndo(() => data.deleteMeal(id), (row) => data.restoreRow('meals', row), 'Meal deleted');
  };

  const deleteWorkout = (id) => removeWithUndo(() => data.deleteWorkout(id), data.restoreWorkout, 'Workout deleted');

  const applyCalorieTarget = async (calories, label) => {
    const previous = profile.targets;
    const next = retargetCalories(previous, calories);
    if (!(await confirm(`Set your daily target to ${fmtCalories(calories)} (${label})? Protein and fat stay the same; carbs change to ${next.carbs} g.`, 'Update calorie target', { confirmLabel: 'Update target' }))) return;
    await run(() => data.updateProfile({ targets: next }));
    notify(`Target set to ${fmtCalories(calories)}`, { tone: 'good', duration: 6000, action: { label: 'Undo', onClick: () => run(() => data.updateProfile({ targets: previous }), 'Target restored') } });
  };

  // buildPhoto's errors are already written for the user (bad file, too large,
  // browser can't decode it), so they go straight to the alert rather than the
  // generic "Something went wrong" in run().
  const addPhoto = async (file) => {
    try {
      const built = await buildPhoto(file);
      await data.addProgressPhoto({ date: dateKey(), ...built });
      notify('Photo added', { tone: 'good' });
    } catch (error) {
      await alert(error.message, 'Couldn’t add photo');
    }
  };

  const saveExercise = (exercise) => run(async () => {
    if (modal?.exercise?.id) await data.updateExercise(modal.exercise.id, exercise);
    else await data.addExercise(exercise);
    closeModal();
  }, 'Exercise saved');

  const deleteExercise = async (id) => {
    const used = workouts.some((workout) => workout.sets?.some((set) => String(set.exerciseId) === String(id)));
    const message = used
      ? 'This exercise is used in logged workouts. Those sets keep their muscle volume but will show as “Deleted exercise”.'
      : 'Delete this custom exercise?';
    if (await confirm(message, 'Delete exercise', { confirmLabel: 'Delete', danger: true })) {
      await run(() => data.deleteExercise(id), 'Exercise deleted');
      closeModal();
    }
  };

  const saveGoal = (goal) => run(async () => {
    if (modal?.goal?.id) await data.updateGoal(modal.goal.id, goal);
    else await data.addGoal(goal);
    closeModal();
  }, 'Goal saved');

  // ---- Plans, live sessions, routes ----

  const closeWithConfirm = async (dirty, message = 'Your changes haven’t been saved.') => {
    if (!dirty || await confirm(message, 'Discard changes?', { confirmLabel: 'Discard', danger: true })) closeModal();
  };

  const startSession = async ({ plan, name = 'Workout', blocks = [] }) => {
    primeAudio(); // still inside the tap, so later beeps are allowed to play
    if (session && !(await confirm(`“${session.initial.name}” is still in progress. Discard it and start a new workout?`, 'Start a new workout?', { confirmLabel: 'Discard & start', danger: true }))) {
      setSessionMinimized(false);
      return;
    }
    const state = createSession({ plan: plan ?? { name, blocks }, now: Date.now(), workouts, settings: profile.sessionSettings });
    const saved = await run(() => data.saveActiveSession(state));
    if (saved === undefined) return;
    closeModal();
    setSession({ initial: state, key: Date.now() });
    setSessionMinimized(false);
  };

  const quickStart = (kind) => (kind === 'run'
    ? startSession({ name: 'Run', blocks: [{ kind: 'cardio', activity: 'run', gps: true, goal: { type: 'open' } }] })
    : startSession({ name: 'Workout', blocks: [] }));

  const runRoute = (route) => startSession({ name: route.name, blocks: [{ kind: 'cardio', activity: 'run', gps: true, routeId: route.id, goal: { type: 'distance', meters: route.distance } }] });

  // Pick a half-finished workout back up after a reload (or the phone killing the app).
  const sessionChecked = useRef(false);
  useEffect(() => {
    if (sessionChecked.current || activeSessionCount === undefined) return;
    sessionChecked.current = true;
    if (activeSessionCount > 0) {
      data.getActiveSession().then((saved) => saved && setSession({ initial: resumeSession(saved, Date.now()), key: Date.now() }));
    } else if (pendingQuickStart.current) {
      quickStart(pendingQuickStart.current);
    }
    pendingQuickStart.current = null;
    // quickStart only needs to run with whatever this first render has.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSessionCount]);

  const persistSession = useCallback((state) => data.saveActiveSession(state).catch(() => {}), []);

  const finishSession = async (state, { updatePlan, now }) => {
    const { workout, track } = sessionToWorkout(state, { now });
    if (!workout.sets.length && !workout.cardio.length) return false;
    if (track) workout.routePreview = samplePath(trackLatLngs(track.segments).flat(), 60);
    const records = findPersonalRecords(workouts, workout.sets);
    const plan = updatePlan ? plans.find((item) => item.id === state.planId) : null;
    const saved = await run(async () => {
      await data.saveSessionWorkout({ workout, track }, exercises);
      if (plan) await data.updatePlan(plan.id, { ...plan, blocks: sessionPlanUpdate(state) });
      return true;
    });
    if (!saved) return false;
    setSession(null);
    setSessionMinimized(false);
    setTrainingSection('workouts');
    const summary = [workout.distance > 0 ? fmtDistance(workout.distance, profile.units) : null, workout.sets.length ? `${workout.sets.length} sets` : null, fmtClock(workout.durationSeconds)].filter(Boolean).join(' · ');
    if (records.length) {
      const [top] = records;
      notify(`New PR: ${exerciseName(exercises, top.exerciseId)} ${fmtWeight(top.e1rm, profile.units)} e1RM${records.length > 1 ? ` +${records.length - 1} more` : ''}`, { tone: 'good', icon: 'trophy', duration: 5000 });
    } else {
      notify(`Workout saved · ${summary}`, { tone: 'good', duration: 4000 });
    }
    return true;
  };

  const discardSession = async () => {
    if (!(await confirm('Nothing from this workout will be saved.', 'Discard workout?', { confirmLabel: 'Discard', danger: true }))) return false;
    await data.clearActiveSession();
    setSession(null);
    setSessionMinimized(false);
    notify('Workout discarded');
    return true;
  };

  const savePlan = async (plan, { start } = {}) => {
    const saved = await run(async () => {
      if (plan.id) {
        await data.updatePlan(plan.id, plan);
        return plan;
      }
      return { ...plan, id: await data.addPlan(plan) };
    }, start ? null : 'Plan saved');
    if (!saved) return;
    closeModal();
    if (start) startSession({ plan: normalizePlan(saved) });
  };

  const deletePlan = async (id) => {
    closeModal();
    await removeWithUndo(() => data.deletePlan(id), (row) => data.restoreRow('templates', row), 'Plan deleted');
  };

  const saveRoute = async (route, { thenRun } = {}) => {
    const saved = await run(async () => {
      if (route.id) {
        await data.updateRoute(route.id, route);
        return route;
      }
      return { ...route, id: await data.addRoute(route) };
    }, thenRun ? null : 'Route saved');
    if (!saved) return;
    closeModal();
    if (thenRun) runRoute(saved);
  };

  const deleteRoute = async (id) => {
    closeModal();
    await removeWithUndo(() => data.deleteRoute(id), (row) => data.restoreRow('routes', row), 'Route deleted');
  };

  const exportGpx = async (workout, track) => {
    const name = workout.name || 'Run';
    const blob = new Blob([buildGpx({ name, segments: track.segments, activity: track.activity })], { type: 'application/gpx+xml' });
    const outcome = await shareFile({ blob, filename: `finesse-fit-${workout.date}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.gpx`, title: name });
    if (outcome !== SHARE_CANCELLED) notify(outcome === 'shared' ? 'GPX shared' : 'GPX downloaded', { tone: 'good' });
  };

  const saveTrackAsRoute = async (workout, track) => {
    const name = await prompt('Save this run’s path as a route you can run again.', 'Save as route', 'Route name', { confirmLabel: 'Save route', defaultValue: workout.name && workout.name !== 'Run' ? workout.name : `${fmtDistance(workout.distance, profile.units)} route`, autoCapitalize: 'sentences' });
    if (!name?.trim()) return;
    const path = samplePath(trackLatLngs(track.segments).flat(), 1000);
    await run(() => data.addRoute({ name: name.trim(), waypoints: [], path, distance: workout.distance || trackDistance(track.segments), followPaths: false }), `Saved “${name.trim()}”`);
  };

  const lastKnownPlace = workouts.find((workout) => workout.routePreview?.length)?.routePreview[0] ?? routes.find((route) => route.path?.length)?.path[0] ?? null;

  const handleScan = useCallback(async (code) => {
    setScannerOpen(false);
    notify(`Looking up ${code}…`, { busy: true });
    const food = await resolveBarcode(code).catch(() => null);
    if (food) {
      notify(`Found ${food.name}`, { tone: 'good' });
      setModal({ type: 'logFood', food });
    } else {
      notify('Not found — add it once and it’ll be remembered', { duration: 4000 });
      setModal({ type: 'food', barcode: code, logAfterSave: true });
    }
  }, [notify]);

  const handleLabelScanned = useCallback((result) => {
    setScanLabelOpen(false);
    setModal({ type: 'food', prefill: result, logAfterSave: true });
  }, []);

  const searchOnline = async (query) => {
    const term = query.trim();
    if (term.length < 2) return;
    searchController.current?.abort();
    const controller = new AbortController();
    searchController.current = controller;
    setOnlineSearch({ query: term.toLowerCase(), status: 'loading', results: [] });
    try {
      const results = await searchFoods(term, { signal: controller.signal });
      if (!controller.signal.aborted) setOnlineSearch({ query: term.toLowerCase(), status: 'done', results });
    } catch (error) {
      if (!controller.signal.aborted) setOnlineSearch({ query: term.toLowerCase(), status: 'error', results: [], message: error.message });
    }
  };

  const pickOnlineFood = async (food) => {
    const saved = await run(() => saveSearchResult(food));
    if (!saved) return;
    notify(`Saved ${saved.name} to your library`, { tone: 'good' });
    setModal({ type: 'logFood', food: saved });
  };

  const handleExport = async () => {
    const exported = await data.exportData();
    // Opens the system share sheet on a phone (Files, iCloud, AirDrop…) so the
    // backup actually leaves the device; falls back to a download link where
    // the share sheet can't take a file.
    const outcome = await shareJson({ data: exported, filename: `finesse-fit-${dateKey()}.json`, title: 'Finesse Fit backup' });
    if (outcome === 'cancelled') return;
    await data.updateProfile({ lastExportAt: new Date().toISOString(), backupSnoozedUntil: null });
    notify(outcome === 'shared' ? 'Backup shared' : 'Backup exported', { tone: 'good' });
  };

  const handleImport = async (file) => {
    let parsed;
    let counts;
    try {
      parsed = JSON.parse(await file.text());
      counts = data.validateImport(parsed);
    } catch (error) {
      await alert(error instanceof SyntaxError ? 'That file isn’t valid JSON.' : error.message, 'Import failed');
      return;
    }
    const summary = [['foodLogs', 'food logs'], ['workouts', 'workouts'], ['foods', 'foods'], ['goals', 'goals'], ['bodyweightLogs', 'bodyweight logs']]
      .filter(([table]) => counts[table])
      .map(([table, label]) => `${counts[table]} ${label}`)
      .join(', ');
    const mode = await choose(
      `Backup from ${parsed.exportedAt ? new Date(parsed.exportedAt).toLocaleDateString() : 'an unknown date'}${summary ? ` with ${summary}` : ''}. Replace wipes everything on this device first. Merge adds the backup to your current data and may create duplicates.`,
      'Import backup',
      [{ value: 'merge', label: 'Merge' }, { value: 'replace', label: 'Replace all', variant: 'danger' }]
    );
    if (!mode) return;
    await run(() => data.importData(parsed, mode), 'Import complete');
  };

  const clearAll = async () => {
    const typed = await prompt('This permanently deletes all logs, foods, workouts and goals on this device. Type RESET to confirm.', 'Full reset', 'RESET', { confirmLabel: 'Clear everything', danger: true });
    if (typed == null) return;
    if (typed.trim().toUpperCase() === 'RESET') await run(() => data.clearAllData(), 'All data cleared');
    else await alert('Nothing was deleted — the confirmation text didn’t match.', 'Reset cancelled');
  };

  const editLog = (log) => setModal(log.quick ? { type: 'quickAdd', log } : { type: 'logFood', log, food: foods.find((food) => food.id === log.foodId) });

  const viewProps = { profile, foods, foodLogs, dailyTotals, workouts, muscleVolume, bodyweightLogs, goals, exercises, meals, today };

  return (
    <AppShell
      nav={NAV}
      view={view}
      onNavigate={setView}
      brand="Finesse"
      brandTag="FIT"
      brandSub="Training & nutrition"
      sidebarFoot={<><span>Everything stays on this device.</span><span>Works offline.</span></>}
    >
      <main className="page">
        {view === 'dashboard' && (
          <Dashboard
            {...viewProps}
            onSetView={setView}
            onScan={() => setScannerOpen(true)}
            onEditLog={editLog}
            onAddWorkout={() => setModal({ type: 'workout' })}
            onProfile={() => setModal({ type: 'profile' })}
            onSaveMeal={saveMealFromLogs}
            onCopyLogs={copyLogs}
            onExport={handleExport}
            onSnoozeBackup={() => data.updateProfile({ backupSnoozedUntil: snoozeUntil(7) })}
            onDismissReview={(week) => data.updateProfile({ reviewDismissedWeek: week })}
          />
        )}
        {view === 'logFood' && (
          <LogFood
            {...viewProps}
            onScan={() => setScannerOpen(true)}
            onScanLabel={() => setScanLabelOpen(true)}
            onPickFood={(food) => setModal({ type: 'logFood', food })}
            onAddFood={() => setModal({ type: 'food', logAfterSave: true })}
            onEditLog={editLog}
            onLogMeal={(meal) => setModal({ type: 'logMeal', meal })}
            onQuickAdd={() => setModal({ type: 'quickAdd' })}
            onlineSearch={onlineSearch}
            onSearchOnline={searchOnline}
            onPickOnline={pickOnlineFood}
            onCopyLogs={copyLogs}
          />
        )}
        {view === 'training' && (
          <Training
            section={trainingSection}
            onSectionChange={setTrainingSection}
            workouts={workouts}
            exercises={exercises}
            units={profile.units}
            today={today}
            onAddWorkout={() => setModal({ type: 'workout' })}
            onRepeatWorkout={(workout) => setModal({ type: 'workout', template: { sets: workout.sets } })}
            onEditWorkout={(workout) => setModal({ type: 'workout', workout })}
            onDeleteWorkout={deleteWorkout}
            muscleVolume={muscleVolume}
            bodyweightLogs={bodyweightLogs}
            dailyTotals={dailyTotals}
            profile={profile}
            photos={progressPhotos}
            onLogBodyweight={() => setModal({ type: 'bodyweight' })}
            onDeleteBodyweight={(id) => removeWithUndo(() => data.deleteBodyweightLog(id), (row) => data.restoreRow('bodyweightLogs', row), 'Entry deleted')}
            workoutProps={{
              plans,
              routes,
              sessionName: session ? session.initial.name : null,
              onOpenSession: () => setSessionMinimized(false),
              onStartPlan: (plan) => startSession({ plan }),
              onQuickStart: quickStart,
              onNewPlan: () => setModal({ type: 'plan' }),
              onEditPlan: (plan) => setModal({ type: 'plan', plan }),
              onDuplicatePlan: (plan) => run(() => data.addPlan({ ...plan, id: undefined, name: `${plan.name} (copy)` }), 'Plan duplicated'),
              onDeletePlan: deletePlan,
              onPlanRoute: () => setModal({ type: 'route' }),
              onEditRoute: (route) => setModal({ type: 'route', route }),
              onRunRoute: runRoute,
              onDeleteRoute: deleteRoute,
              onOpenActivity: (workout) => setModal({ type: 'activity', workout })
            }}
            onApplyCalories={applyCalorieTarget}
            onAddPhoto={addPhoto}
            onDeletePhoto={(id) => removeWithUndo(() => data.deleteProgressPhoto(id), (row) => data.restoreRow('photos', row), 'Photo deleted')}
            goals={goals}
            goalData={{ workouts, muscleVolume, dailyTotals, bodyweightLogs, profile }}
            onAddGoal={() => setModal({ type: 'goal' })}
            onEditGoal={(goal) => setModal({ type: 'goal', goal })}
            onDeleteGoal={(id) => removeWithUndo(() => data.deleteGoal(id), (row) => data.restoreRow('goals', row), 'Goal deleted')}
          />
        )}
        {view === 'settings' && (
          <Settings
            profile={profile}
            appearance={profile.appearance}
            resolvedTheme={resolvedTheme}
            storageState={storageState}
            storageEstimate={storageEstimate}
            onRequestPersistence={async () => notify((await requestPersistence()) ? 'Storage is now protected' : 'Your browser declined — install the app to your home screen and try again', { duration: 4000 })}
            onProfile={() => setModal({ type: 'profile' })}
            onProfileChange={(patch) => data.saveProfile({ ...profile, ...patch })}
            onAppearanceChange={(patch) => data.updateProfile({ appearance: { ...profile.appearance, ...patch } })}
            onExport={handleExport}
            onImport={handleImport}
            onClear={clearAll}
          />
        )}
      </main>

      {scannerOpen && <BarcodeScanner onDetected={handleScan} onClose={() => setScannerOpen(false)} />}
      {scanLabelOpen && <ScanLabelModal onScanned={handleLabelScanned} onClose={() => setScanLabelOpen(false)} />}
      {modal?.type === 'profile' && (
        <ProfileModal
          profile={profile}
          onboarding={modal.onboarding}
          // Skipping onboarding keeps the default targets and stops it reopening on every launch.
          onClose={modal.onboarding ? () => data.saveProfile({ ...profile, onboarded: true }).then(closeModal) : closeModal}
          onSave={(next) => run(async () => { await data.saveProfile(next); closeModal(); }, modal.onboarding ? 'You’re all set' : 'Profile saved')}
        />
      )}
      {modal?.type === 'food' && <FoodModal food={modal.food} barcode={modal.barcode} prefill={modal.prefill} onClose={closeModal} onSave={saveFood} />}
      {modal?.type === 'logFood' && <LogFoodModal food={modal.food} log={modal.log} onClose={closeModal} onSave={saveFoodLog} onDelete={deleteFoodLog} />}
      {modal?.type === 'exercise' && <ExerciseModal exercise={modal.exercise} onClose={closeModal} onSave={saveExercise} onDelete={deleteExercise} />}
      {modal?.type === 'workout' && <WorkoutModal workout={modal.workout} template={modal.template} exercises={exercises} workouts={workouts} units={profile.units} restSeconds={profile.restSeconds ?? 90} onRestSecondsChange={(restSeconds) => restSeconds !== profile.restSeconds && data.updateProfile({ restSeconds })} onClose={closeWorkout} onSave={saveWorkout} onDelete={(id) => { closeModal(); deleteWorkout(id); }} />}
      {modal?.type === 'goal' && <GoalModal goal={modal.goal} exercises={exercises} units={profile.units} latestBodyweight={latestBodyweight} onClose={closeModal} onSave={saveGoal} />}
      {modal?.type === 'bodyweight' && <BodyweightModal units={profile.units} latest={latestBodyweight} onClose={closeModal} onSave={(row) => run(async () => { await data.addBodyweightLog(row); closeModal(); }, 'Bodyweight logged')} />}
      {modal?.type === 'quickAdd' && <QuickAddModal log={modal.log} onClose={closeModal} onSave={saveQuickLog} onDelete={deleteFoodLog} />}
      {modal?.type === 'logMeal' && <LogMealModal meal={modal.meal} onClose={closeModal} onLog={logMeal} onDelete={deleteMeal} />}
      {modal?.type === 'plan' && <PlanModal plan={modal.plan} exercises={exercises} routes={routes} units={profile.units} onClose={(dirty) => closeWithConfirm(dirty)} onSave={savePlan} onDelete={deletePlan} />}
      {modal?.type === 'route' && (
        <RoutePlannerModal
          route={modal.route}
          defaultCenter={lastKnownPlace}
          units={profile.units}
          onClose={(dirty) => closeWithConfirm(dirty)}
          onSave={saveRoute}
          onDelete={deleteRoute}
          onRun={runRoute}
          onNotice={(message) => notify(message, { duration: 4000 })}
        />
      )}
      {modal?.type === 'activity' && (
        <ActivityModal
          workout={workouts.find((workout) => workout.id === modal.workout.id) ?? modal.workout}
          track={activityTrack}
          exercises={exercises}
          units={profile.units}
          onClose={closeModal}
          onEditSets={(workout) => setModal({ type: 'workout', workout })}
          onDelete={(id) => { closeModal(); deleteWorkout(id); }}
          onExportGpx={exportGpx}
          onSaveRoute={saveTrackAsRoute}
        />
      )}
      {session && (
        <WorkoutSession
          key={session.key}
          initial={session.initial}
          plan={plans.find((plan) => plan.id === session.initial.planId) ?? null}
          exercises={exercises}
          workouts={workouts}
          routes={routes}
          units={profile.units}
          minimized={sessionMinimized}
          onMinimize={() => setSessionMinimized(true)}
          onExpand={() => setSessionMinimized(false)}
          onPersist={persistSession}
          onFinish={finishSession}
          onDiscard={discardSession}
          onSettingsChange={(sessionSettings) => data.updateProfile({ sessionSettings })}
        />
      )}
      {Dialog}
      <Toast notice={notice} onDismiss={dismissNotice} />
    </AppShell>
  );
}
