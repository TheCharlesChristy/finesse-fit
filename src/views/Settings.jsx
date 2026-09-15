import { useState } from 'react';
import { Database, Download, HardDrive, Info, Palette, RefreshCw, RotateCcw, Ruler, ShieldCheck, Upload, UserRound } from 'lucide-react';

import AppearanceSettings from '../components/AppearanceSettings.jsx';
import { Card, Meter, PageHeader, Segmented, Tabs } from '../components/ui.jsx';
import { APP_COMMIT, APP_VERSION, formatBuiltAt } from '../buildInfo.js';
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

// Settings is a consolidated page like Training, for the same reason: the
// appearance panel alone is four cards deep, and burying Backup underneath it
// would hide the one setting that protects the data.
const TABS = [
  { id: 'appearance', label: 'Appearance', Icon: Palette },
  { id: 'profile', label: 'Profile', Icon: UserRound },
  { id: 'data', label: 'Data', Icon: Database },
  { id: 'about', label: 'About', Icon: Info }
];

export default function Settings({
  profile, appearance, resolvedTheme = 'dark', storageState, storageEstimate,
  onRequestPersistence, onProfile, onProfileChange, onAppearanceChange, onExport, onImport, onClear
}) {
  const [tab, setTab] = useState('appearance');
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
    <>
      <PageHeader eyebrow="Finesse Fit" title="Settings" subtitle="Appearance, profile, units, backup and reset." />
      <Tabs label="Settings sections" tabs={TABS} value={tab} onChange={setTab} />

      {tab === 'appearance' && (
        <div className="stack-lg">
          <AppearanceSettings appearance={appearance} theme={resolvedTheme} onChange={onAppearanceChange} />
        </div>
      )}

      {tab === 'profile' && (
        <div className="grid-auto">
          <Card title="Body & targets" icon={UserRound}>
            <div className="list-row stacked">
              <strong>{fmtHeight(profile.height, profile.heightUnit ?? profile.units)} · {fmtWeight(profile.bodyweight, profile.units)}</strong>
              <span className="muted">Target {fmtWeight(profile.targetBodyweight ?? profile.bodyweight, profile.units)}{profile.targetBodyFat != null ? ` · ${profile.targetBodyFat}% body fat` : ''}</span>
              {profile.trainingDays && <span className="muted">{trainingDaysLabel(profile.trainingDays)} training days a week · {priorityLabel(normalizePriorities(profile.priorities)[0])} first</span>}
              <span className="muted">{fmtCalories(profile.targets.calories)} · P {fmtMacro(profile.targets.protein)} · C {fmtMacro(profile.targets.carbs)} · F {fmtMacro(profile.targets.fat)}</span>
            </div>
            <button className="btn-primary" type="button" onClick={onProfile}>Edit profile & body targets</button>
          </Card>

          <Card title="Units" icon={Ruler}>
            <Segmented
              label="Weight"
              value={profile.units}
              options={[{ value: 'metric', label: 'kg' }, { value: 'imperial', label: 'lb' }]}
              onChange={(units) => onProfileChange({ units, weightUnit: units })}
            />
            <Segmented
              label="Height"
              value={profile.heightUnit ?? 'metric'}
              options={[{ value: 'metric', label: 'cm' }, { value: 'imperial', label: 'ft / in' }]}
              onChange={(heightUnit) => onProfileChange({ heightUnit })}
            />
          </Card>
        </div>
      )}

      {tab === 'data' && (
        <div className="grid-auto">
          <Card title="Backup" icon={Download}>
            <p className="field-hint">Your data only lives in this browser. Export a backup regularly — especially before clearing site data or switching phones.</p>
            <div className="list-row">
              <span className="list-main"><span className="list-title">Last backup</span></span>
              <span className={profile.lastExportAt ? 'secondary nowrap' : 'status-warn'}>
                {profile.lastExportAt ? fmtDate(profile.lastExportAt, 'd MMM yyyy') : 'Never'}
              </span>
            </div>
            <button className="btn-primary" type="button" onClick={onExport}><Download size={18} /> Export JSON</button>
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
            <p className="field-hint">Progress photos are not in the backup — they are image bytes and stay on this device.</p>
          </Card>

          <Card title="Storage" icon={HardDrive}>
            <p className="field-hint">A browser treats app data as disposable by default and may clear it to reclaim space. Persistent storage asks it not to — then only you can clear it.</p>
            {storageState === STORAGE_UNSUPPORTED ? (
              <p className="muted text-sm">This browser doesn’t expose storage persistence. Keep exporting backups.</p>
            ) : storageState === STORAGE_PERSISTED ? (
              <div className="row">
                <span className="status-good"><ShieldCheck size={14} aria-hidden="true" /> Protected</span>
                <span className="muted text-sm">This browser won’t evict your data</span>
              </div>
            ) : (
              <>
                <button className="btn-secondary" type="button" onClick={onRequestPersistence} disabled={storageState === null}>
                  <ShieldCheck size={16} aria-hidden="true" /> Protect my data
                </button>
                {storageState === STORAGE_BEST_EFFORT && (
                  <p className="muted text-sm">Currently evictable — being on your home screen and used regularly makes a yes more likely.</p>
                )}
              </>
            )}
            {storageEstimate && (
              <div className="detail-list">
                <div className="detail-row"><span className="muted">Used</span><span>{formatBytes(storageEstimate.usage)} of {formatBytes(storageEstimate.quota)}</span></div>
                <Meter
                  label="Storage used"
                  value={Math.max(1, Math.min(100, storageEstimate.percent))}
                  max={100}
                  tone={storageEstimate.percent > 85 ? 'var(--danger)' : undefined}
                />
              </div>
            )}
          </Card>

          <Card title="Reset" icon={RotateCcw}>
            <p className="field-hint">Clears every log, food, workout, goal and derived counter on this device. Export first if you might want it back.</p>
            <button className="btn-danger" type="button" onClick={onClear}>Clear all data</button>
          </Card>
        </div>
      )}

      {tab === 'about' && (
        <div className="grid-auto">
          <Card title="This build" icon={Info}>
            <p className="field-hint">Finesse Fit checks for a new build hourly, but an app on your home screen can sit on a cached copy for a while — update now if you’re waiting on a change.</p>
            <div className="detail-list">
              <div className="detail-row"><span className="muted">Version</span><span className="font-mono">{APP_VERSION}</span></div>
              <div className="detail-row"><span className="muted">Build</span><span className="font-mono">{APP_COMMIT}</span></div>
              <div className="detail-row"><span className="muted">Built</span><span>{formatBuiltAt() ?? 'Unknown'}</span></div>
            </div>
            <button className="btn-secondary" type="button" onClick={handleUpdateApp} disabled={checkingUpdate}>
              <RefreshCw size={16} className={checkingUpdate ? 'spin' : undefined} aria-hidden="true" /> {checkingUpdate ? 'Checking…' : 'Check for update'}
            </button>
            {updateMessage && <p className="muted text-sm">{updateMessage}</p>}
            {updateReady && !updateMessage && <p className="secondary text-sm">A newer build is already downloaded — update now to switch to it.</p>}
          </Card>

          <Card title="Privacy" icon={ShieldCheck}>
            <p className="field-hint">
              Everything you log is stored in this browser and never sent anywhere. The two exceptions
              are looking a barcode up on Open Food Facts and searching it by name, both of which send
              only the barcode or the words you typed.
            </p>
            <p className="field-hint">Label scanning runs entirely on this device — the photo and its pixels never leave it.</p>
          </Card>
        </div>
      )}
    </>
  );
}
