import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, RotateCcw, ScanText } from 'lucide-react';
import { Modal } from './ui.jsx';
import { OcrUnsupportedError, recognizeLabel } from '../ocr.js';
import { parseNutritionLabel } from '../labelParser.js';

const STATUS_TEXT = {
  'loading language traineddata': 'Loading the OCR engine…',
  'initializing api': 'Loading the OCR engine…',
  'loading tesseract core': 'Loading the OCR engine…',
  'initialized api': 'Reading the label…',
  'recognizing text': 'Reading the label…'
};

const describeStatus = (status) => STATUS_TEXT[status] || 'Working…';

function describeFailure(error) {
  if (error instanceof OcrUnsupportedError) return error.message;
  if (error?.name === 'StageError') return `Couldn’t read that photo — it failed while ${error.stage}. Try a clearer, well-lit shot, or enter the numbers by hand.`;
  return error?.message || 'Couldn’t read that photo. Try a clearer, well-lit shot, or enter the numbers by hand.';
}

/**
 * Photo-in, parsed-macros-out. This modal only gets from a photo to a
 * candidate reading — it hands the result to `onScanned` and closes; the
 * caller opens the regular food form (FoodModal, via its `prefill` prop) so
 * every value still gets a human check before it's saved, same as a
 * barcode's manual-entry fallback.
 */
export default function ScanLabelModal({ onClose, onScanned }) {
  const [phase, setPhase] = useState('pick'); // pick | working | error
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('Starting…');
  const [error, setError] = useState(null);
  const inputRef = useRef(null);
  // Not just `useRef(true)` — StrictMode's dev-only double-invoke runs this
  // effect's cleanup once right after the first mount, and a ref only ever
  // initialised at declaration never gets set back to true afterwards. The
  // setup has to (re)affirm `true` itself so the real, final mount ends up
  // live rather than permanently latched false by that synthetic cycle.
  const live = useRef(true);

  useEffect(() => {
    live.current = true;
    return () => { live.current = false; };
  }, []);

  const runOcr = async (file) => {
    setPhase('working');
    setProgress(0);
    setStatusText('Starting…');
    setError(null);
    try {
      const text = await recognizeLabel(file, (message) => {
        if (!live.current) return;
        if (message?.status) setStatusText(describeStatus(message.status));
        if (typeof message?.progress === 'number') setProgress(Math.round(message.progress * 100));
      });
      if (!live.current) return;
      onScanned(parseNutritionLabel(text));
    } catch (err) {
      if (!live.current) return;
      setPhase('error');
      setError(err);
    }
  };

  const pick = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) runOcr(file);
  };

  return (
    <Modal title="Scan nutrition label" onClose={onClose} size="sm">
      {phase === 'pick' && (
        <div className="stack" style={{ alignItems: 'center', textAlign: 'center', gap: 14 }}>
          <ScanText size={36} style={{ color: 'var(--accent)' }} aria-hidden="true" />
          <p className="muted" style={{ margin: 0 }}>Photograph the nutrition table on the pack — the “per 100g” column reads best. It’s scanned on this device; the photo itself is never uploaded anywhere.</p>
          <label className="btn-primary" style={{ cursor: 'pointer' }}>
            Take or choose a photo
            <input ref={inputRef} type="file" accept="image/*" className="sr-only" onChange={pick} />
          </label>
        </div>
      )}

      {phase === 'working' && (
        <div className="stack" style={{ alignItems: 'center', textAlign: 'center', gap: 14 }}>
          <ScanText size={36} style={{ color: 'var(--accent)' }} aria-hidden="true" />
          <div className="progress-track" style={{ width: '100%' }} role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
            <div className="progress-fill" style={{ '--value': `${progress}%` }} />
          </div>
          <span className="muted">{statusText}</span>
        </div>
      )}

      {phase === 'error' && (
        <div className="stack" style={{ alignItems: 'center', textAlign: 'center', gap: 14 }}>
          <AlertTriangle size={32} style={{ color: 'var(--danger)' }} aria-hidden="true" />
          <p className="muted" style={{ margin: 0 }}>{describeFailure(error)}</p>
          <div className="row">
            <button className="btn-secondary" type="button" onClick={onClose}>Cancel</button>
            <label className="btn-primary" style={{ cursor: 'pointer' }}>
              <RotateCcw size={16} /> Try another photo
              <input type="file" accept="image/*" className="sr-only" onChange={pick} />
            </label>
          </div>
        </div>
      )}
    </Modal>
  );
}
