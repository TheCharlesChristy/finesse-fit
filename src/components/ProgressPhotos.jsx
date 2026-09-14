import { useState } from 'react';
import { Camera, Trash2 } from 'lucide-react';
import { fmtDate } from '../utils.js';
import { useBlobUrl } from './useBlobUrl.js';
import { Modal } from './ui.jsx';

function Thumb({ photo, onOpen }) {
  const url = useBlobUrl(photo.thumb);
  return (
    <button type="button" className="photo-thumb" onClick={() => onOpen(photo)} aria-label={`Open photo from ${fmtDate(photo.date)}`}>
      {url && <img src={url} alt="" loading="lazy" />}
      <span className="photo-thumb-date">{fmtDate(photo.date, 'd MMM')}</span>
    </button>
  );
}

function Lightbox({ photo, onClose, onDelete }) {
  const url = useBlobUrl(photo.full);
  return (
    <Modal title={fmtDate(photo.date, 'EEEE d MMMM yyyy')} onClose={onClose} size="lg">
      <div className="photo-viewer">
        {url ? <img src={url} alt={`Progress photo from ${fmtDate(photo.date)}`} /> : <div className="photo-viewer-loading">Loading…</div>}
      </div>
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn-danger" type="button" onClick={() => onDelete(photo.id)}><Trash2 size={18} /> Delete photo</button>
      </div>
    </Modal>
  );
}

// A horizontal timeline of progress photos, newest first, with a lightbox to
// view and delete. Deliberately its own card rather than tied to a specific
// bodyweight entry — a photo documents a moment, not a number.
export default function ProgressPhotos({ photos, onAdd, onDelete }) {
  const [open, setOpen] = useState(null);
  const [busy, setBusy] = useState(false);
  const ordered = photos.slice().reverse();

  const pick = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      await onAdd(file);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="photo-strip">
        <label className={`photo-add ${busy ? 'busy' : ''}`}>
          <Camera size={20} />
          <span>{busy ? 'Adding…' : 'Add'}</span>
          <input type="file" accept="image/*" className="sr-only" onChange={pick} disabled={busy} />
        </label>
        {ordered.map((photo) => <Thumb key={photo.id} photo={photo} onOpen={setOpen} />)}
      </div>
      {!photos.length && <span className="muted">A private visual record, right alongside the numbers. Photos stay on this device and aren’t included in the JSON backup.</span>}
      {open && (
        <Lightbox
          photo={open}
          onClose={() => setOpen(null)}
          onDelete={(id) => { setOpen(null); onDelete(id); }}
        />
      )}
    </>
  );
}
