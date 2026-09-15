import { useState } from 'react';
import { Download, Info, Palette, RefreshCw, RotateCcw, Ruler, ShieldCheck, Upload, UserRound } from 'lucide-react';
import PaletteSelect from '../components/PaletteSelect.jsx';
import { CardTitle, PageHeader, Segmented } from '../components/ui.jsx';
import { APP_COMMIT, APP_VERSION, formatBuiltAt } from '../buildInfo.js';
import { DEFAULT_PALETTE, PALETTES, paletteExists } from '../data/palettes.js';
import { isUpdatePending, updateApp } from '../pwa.js';
import { formatBytes, STORAGE_BEST_EFFORT, STORAGE_PERSISTED, STORAGE_UNSUPPORTED } from '../storage.js';
import { fmtCalories, fmtDate, fmtHeight, fmtMacro, fmtWeight, normalizePriorities, priorityLabel, trainingDaysLabel } from '../utils.js';

// What updateApp() found, in the user's terms. Anything unrecognised falls
// back to 'error' — silence is the one outcome a manual check mustn't have.
const UPDATE_MESSAGES = {
  current: 'You’re already on the latest version.',
  unregistered: 'No service worker is running for this page yet, so there’s nothing cached to update. Normal before the app has been added to your home screen.',
  unsupported: 'This browser doesn’t support service workers, so the app is never cached — a normal refresh always gets the latest version.',
  error: 'Couldn’t check for an update. Make sure you’re online and try again.'
};

export default function Settings({ profile, resolvedTheme = 'dark', storageState, storageEstimate, onRequestPersistence, onProfile, onProfileChange, onExport, onImport, onClear }) {
  const activePalette = paletteExists(profile.palette) ? profile.palette : DEFAULT_PALETTE;
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateReady, setUpdateReady] = useState(() => isUpdatePending());
  const [updateMessage, setUpdateMessage] = useState(null);

  const handleUpdateApp = async () => {
    setCheckingUpdate(true);
    setUpdateMessage(null);
    try {
      const { status } = await updateApp();
      setUpdateReady(isUpdatePending());
      // 'updated' reloads the page from updateApp — nobody is left to tell.
      if (status !== 'updated') setUpdateMessage(UPDATE_MESSAGES[status] ?? UPDATE_MESSAGES.error);
    } finally {
      setCheckingUpdate(false);
    }
  };

  return (
    <main className="page">
      <PageHeader title="Settings" subtitle="Appearance, profile, units, backup and reset." />
      <div className="grid-auto">
        <section className="card panel stack">
          <CardTitle icon={Palette}>Appearance</CardTitle>
          <div className="field">
            <span className="field-label" id="palette-label">Colour palette</span>
            <PaletteSelect palettes={PALETTES} value={activePalette} theme={resolvedTheme} onChange={(palette) => onProfileChange({ palette })} />
          </div>
          <Segmented
            label="Theme"
            value={profile.themeMode ?? 'dark'}
            options={[{ value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }, { value: 'system', label: 'Auto' }]}
            onChange={(themeMode) => onProfileChange({ themeMode })}
          />
        </section>
        <section className="card panel stack">
          <CardTitle icon={UserRound}>Profile</CardTitle>
          <div className="list-row stack" style={{ gap: 4 }}>
            <strong>{fmtHeight(profile.height, profile.heightUnit ?? profile.units)} · {fmtWeight(profile.bodyweight, profile.units)}</strong>
            <div className="muted">Target {fmtWeight(profile.targetBodyweight ?? profile.bodyweight, profile.units)}{profile.targetBodyFat != null ? ` · ${profile.targetBodyFat}% body fat` : ''}</div>
            {profile.trainingDays && <div className="muted">{trainingDaysLabel(profile.trainingDays)} training days a week · {priorityLabel(normalizePriorities(profile.priorities)[0])} first</div>}
            <div className="muted">{fmtCalories(profile.targets.calories)} · P {fmtMacro(profile.targets.protein)} · C {fmtMacro(profile.targets.carbs)} · F {fmtMacro(profile.targets.fat)}</div>
          </div>
          <button className="btn-primary" type="button" onClick={onProfile}>Edit profile & body targets</button>
        </section>
        <section className="card panel stack">
          <CardTitle icon={Ruler}>Units</CardTitle>
          <Segmented
            label="Weight units"
            value={profile.units}
            options={[{ value: 'metric', label: 'kg' }, { value: 'imperial', label: 'lb' }]}
            onChange={(units) => onProfileChange({ units, weightUnit: units })}
          />
          <Segmented
            label="Height units"
            value={profile.heightUnit ?? 'metric'}
            options={[{ value: 'metric', label: 'cm' }, { value: 'imperial', label: 'ft / in' }]}
            onChange={(heightUnit) => onProfileChange({ heightUnit })}
          />
        </section>
        <section className="card panel stack">
          <CardTitle icon={ShieldCheck}>Storage</CardTitle>
          <p className="secondary" style={{ margin: 0 }}>A browser treats app data as disposable by default and may clear it to reclaim space. Persistent storage asks it not to — then only you can clear it.</p>
          {storageState === STORAGE_UNSUPPORTED ? (
            <p className="muted" style={{ margin: 0, fontSize: '0.88rem' }}>This browser doesn’t expose storage persistence. Keep exporting backups.</p>
          ) : storageState === STORAGE_PERSISTED ? (
            <div className="row" style={{ gap: 8 }}>
              <span className="status-good"><ShieldCheck size={14} /> Protected</span>
              <span className="muted" style={{ fontSize: '0.88rem' }}>This browser won’t evict your data</span>
            </div>
          ) : (
            <>
              <button className="btn-secondary" type="button" onClick={onRequestPersistence} disabled={storageState === null}>
                <ShieldCheck size={16} /> Protect my data
              </button>
              {storageState === STORAGE_BEST_EFFORT && (
                <p className="muted" style={{ margin: 0, fontSize: '0.88rem' }}>Currently evictable — being on your home screen and used regularly makes a yes more likely.</p>
              )}
            </>
          )}
          {storageEstimate && (
            <div className="detail-list">
              <div className="detail-row"><span className="muted">Used</span><span>{formatBytes(storageEstimate.usage)} of {formatBytes(storageEstimate.quota)}</span></div>
              <div className="progress-track"><div className="progress-fill" style={{ '--value': `${Math.max(1, Math.min(100, storageEstimate.percent))}%`, '--bar': storageEstimate.percent > 85 ? 'var(--danger)' : undefined }} /></div>
            </div>
          )}
        </section>
        <section className="card panel stack">
          <CardTitle icon={Download}>Backup</CardTitle>
          <p className="secondary" style={{ margin: 0 }}>Your data only lives in this browser. Export a backup regularly, especially before clearing site data or switching phones.</p>
          <div className="list-row"><span><strong>Last backup:</strong> <span className={profile.lastExportAt ? 'secondary' : 'status-warn'}>{profile.lastExportAt ? fmtDate(profile.lastExportAt, 'd MMM yyyy') : 'never'}</span></span></div>
          <button className="btn-secondary" type="button" onClick={onExport}><Download size={18} /> Export JSON</button>
          <label className="btn-secondary file-button">
            <Upload size={18} /> Import JSON
            <input
              type="file"
              accept="application/json,.json"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                // Reset so picking the same file again still fires onChange.
                event.target.value = '';
                if (file) onImport(file);
              }}
            />
          </label>
        </section>
        <section className="card panel stack">
          <CardTitle icon={RotateCcw}>Reset</CardTitle>
          <p className="secondary" style={{ margin: 0 }}>Clears every log, food, workout, goal and derived counter on this device. Export first if you might want it back.</p>
          <button className="btn-danger" type="button" onClick={onClear}>Clear all data</button>
        </section>
        <section className="card panel stack">
          <CardTitle icon={Info}>About</CardTitle>
          <p className="secondary" style={{ margin: 0 }}>Which build this device is running. Finesse Fit checks for a new one hourly, but an app on your home screen can sit on a cached copy for a while — update now if you’re waiting on a change.</p>
          <div className="detail-list">
            <div className="detail-row"><span className="muted">Version</span><span>{APP_VERSION}</span></div>
            <div className="detail-row"><span className="muted">Build</span><span>{APP_COMMIT}</span></div>
            <div className="detail-row"><span className="muted">Built</span><span>{formatBuiltAt() ?? 'Unknown'}</span></div>
          </div>
          <button className="btn-secondary" type="button" onClick={handleUpdateApp} disabled={checkingUpdate}>
            <RefreshCw size={16} /> {checkingUpdate ? 'Checking…' : 'Check for update'}
          </button>
          {updateMessage && <p className="muted" style={{ margin: 0, fontSize: '0.88rem' }}>{updateMessage}</p>}
          {updateReady && !updateMessage && <p className="secondary" style={{ margin: 0, fontSize: '0.88rem' }}>A newer build is already downloaded — update now to switch to it.</p>}
        </section>
      </div>
    </main>
  );
}
