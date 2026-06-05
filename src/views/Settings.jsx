import { Download, RotateCcw, Upload, UserRound } from 'lucide-react';
import { CardTitle } from '../components/ui.jsx';
import { fmtHeight, fmtWeight } from '../utils.js';

export default function Settings({ profile, onProfile, onProfileChange, onExport, onImport, onClear }) {
  return (
    <main className="page">
      <div>
        <h1 className="font-display page-title">Settings</h1>
        <p className="secondary">Profile, targets, theme, export/import, and reset.</p>
      </div>
      <div className="grid-auto">
        <section className="glass panel stack">
          <CardTitle icon={UserRound}>Profile</CardTitle>
          <div className="list-row">
            <strong>Body stats and goal blend</strong>
            <div className="muted">{fmtHeight(profile.height, profile.units)} · {fmtWeight(profile.bodyweight, profile.units)}</div>
            <div className="muted">{profile.targets.calories} kcal · P {profile.targets.protein} · C {profile.targets.carbs} · F {profile.targets.fat}</div>
          </div>
          <button className="btn-primary" type="button" onClick={onProfile}>Edit profile</button>
        </section>
        <section className="glass panel stack">
          <CardTitle>Display</CardTitle>
          <label className="field">
            <span>Theme</span>
            <select className="glass-input" value={profile.themeMode} onChange={(event) => onProfileChange({ themeMode: event.target.value })}>
              <option value="dark">dark</option>
              <option value="light">light</option>
              <option value="system">system</option>
            </select>
          </label>
          <label className="field">
            <span>App units</span>
            <select className="glass-input" value={profile.units} onChange={(event) => onProfileChange({ units: event.target.value })}>
              <option value="metric">metric</option>
              <option value="imperial">imperial</option>
            </select>
          </label>
        </section>
        <section className="glass panel stack">
          <CardTitle icon={Download}>Backup</CardTitle>
          <button className="btn-secondary" type="button" onClick={onExport}><Download size={18} /> Export JSON</button>
          <label className="btn-secondary row" style={{ justifyContent: 'center' }}>
            <Upload size={18} /> Import JSON
            <input type="file" accept="application/json" hidden onChange={(event) => event.target.files?.[0] && onImport(event.target.files[0])} />
          </label>
        </section>
        <section className="glass panel stack">
          <CardTitle icon={RotateCcw}>Reset</CardTitle>
          <p className="secondary">Full reset clears logs, foods, workouts, goals, and derived counters after typed confirmation.</p>
          <button className="btn-danger" type="button" onClick={onClear}>Clear all data</button>
        </section>
      </div>
    </main>
  );
}
