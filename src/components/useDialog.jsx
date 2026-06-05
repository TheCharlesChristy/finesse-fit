import { useCallback, useState } from 'react';
import { Modal, Field } from './ui.jsx';

export function useDialog() {
  const [dialog, setDialog] = useState(null);

  const ask = useCallback((config) => new Promise((resolve) => {
    setDialog({ ...config, resolve, value: '' });
  }), []);

  const confirm = useCallback((message, title = 'Confirm') => ask({ type: 'confirm', title, message }), [ask]);
  const alert = useCallback((message, title = 'Heads up') => ask({ type: 'alert', title, message }), [ask]);
  const prompt = useCallback((message, title = 'Confirm', placeholder = '') => ask({ type: 'prompt', title, message, placeholder }), [ask]);

  const close = (result) => {
    dialog?.resolve(result);
    setDialog(null);
  };

  const Dialog = dialog ? (
    <Modal title={dialog.title} onClose={() => close(false)}>
      <p className="secondary">{dialog.message}</p>
      {dialog.type === 'prompt' && (
        <Field label={dialog.placeholder || 'Value'}>
          <input className="glass-input" value={dialog.value} onChange={(event) => setDialog({ ...dialog, value: event.target.value })} />
        </Field>
      )}
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        {dialog.type !== 'alert' && <button className="btn-secondary" type="button" onClick={() => close(false)}>Cancel</button>}
        <button className="btn-primary" type="button" onClick={() => close(dialog.type === 'prompt' ? dialog.value : true)}>OK</button>
      </div>
    </Modal>
  ) : null;

  return { confirm, alert, prompt, Dialog };
}
