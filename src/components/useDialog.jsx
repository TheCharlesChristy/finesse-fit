import { useCallback, useRef, useState } from 'react';
import { Modal, Field } from './ui.jsx';

let dialogSeq = 0;

export function useDialog() {
  const [dialog, setDialog] = useState(null);
  const [value, setValue] = useState('');
  const dialogRef = useRef(null);

  const ask = useCallback((config) => new Promise((resolve) => {
    // Settle any dialog that is being replaced so its caller doesn't hang forever.
    dialogRef.current?.resolve(config.cancelValue ?? false);
    const next = { cancelValue: false, ...config, resolve, key: ++dialogSeq };
    dialogRef.current = next;
    setValue(config.defaultValue ?? '');
    setDialog(next);
  }), []);

  const confirm = useCallback((message, title = 'Confirm', { confirmLabel = 'OK', danger = false } = {}) => ask({ type: 'confirm', title, message, confirmLabel, danger }), [ask]);
  const alert = useCallback((message, title = 'Heads up') => ask({ type: 'alert', title, message, cancelValue: true }), [ask]);
  const prompt = useCallback((message, title = 'Confirm', placeholder = '', { confirmLabel = 'OK', danger = false, defaultValue = '', autoCapitalize = 'characters' } = {}) => ask({ type: 'prompt', title, message, placeholder, confirmLabel, danger, defaultValue, autoCapitalize, cancelValue: null }), [ask]);
  // options: [{ value, label, variant: 'primary' | 'secondary' | 'danger' }]; resolves to the chosen value or null.
  const choose = useCallback((message, title, options) => ask({ type: 'choose', title, message, options, cancelValue: null }), [ask]);

  const close = (result) => {
    dialogRef.current = null;
    dialog?.resolve(result);
    setDialog(null);
  };

  const submit = () => {
    if (dialog.type === 'prompt') close(value);
    else if (dialog.type !== 'choose') close(true);
  };

  const Dialog = dialog ? (
    <Modal key={dialog.key} title={dialog.title} size="sm" onClose={() => close(dialog.cancelValue)} onSubmit={submit}>
      <p className="secondary" style={{ margin: 0 }}>{dialog.message}</p>
      {dialog.type === 'prompt' && (
        <Field label={dialog.placeholder || 'Value'}>
          <input className="input" autoComplete="off" autoCapitalize={dialog.autoCapitalize} value={value} onChange={(event) => setValue(event.target.value)} />
        </Field>
      )}
      <div className="row modal-actions">
        {dialog.type === 'choose' ? (
          <>
            <button className="btn-secondary" type="button" onClick={() => close(null)}>Cancel</button>
            {dialog.options.map((option) => (
              <button key={option.value} className={`btn-${option.variant ?? 'secondary'}`} type="button" onClick={() => close(option.value)}>{option.label}</button>
            ))}
          </>
        ) : (
          <>
            {dialog.type !== 'alert' && <button className="btn-secondary" type="button" onClick={() => close(dialog.cancelValue)}>Cancel</button>}
            <button className={dialog.danger ? 'btn-danger' : 'btn-primary'} type="submit">{dialog.confirmLabel ?? 'OK'}</button>
          </>
        )}
      </div>
    </Modal>
  ) : null;

  return { confirm, alert, prompt, choose, Dialog };
}
