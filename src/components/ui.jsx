import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export function Modal({ title, children, onClose, large = false }) {
  const boxRef = useRef(null);

  useEffect(() => {
    const previous = document.activeElement;
    const focusable = boxRef.current?.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    focusable?.focus();
    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab') return;
      const items = [...boxRef.current.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter((item) => !item.disabled);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="modal-overlay" role="presentation" onMouseDown={onClose}>
      <section
        ref={boxRef}
        className={`modal-box glass-strong stack ${large ? 'modal-large' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="split">
          <h2 className="font-display" style={{ fontSize: '2rem', margin: 0 }}>{title}</h2>
          <IconButton label="Close" onClick={onClose}><X size={19} /></IconButton>
        </div>
        {children}
      </section>
    </div>
  );
}

export function Field({ label, children }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
    </div>
  );
}

export function IconButton({ label, children, ...props }) {
  return (
    <button className="btn-icon" type="button" aria-label={label} title={label} {...props}>
      {children}
    </button>
  );
}

export function CardTitle({ icon: Icon, children, action }) {
  return (
    <div className="split">
      <div className="card-title">{Icon && <Icon size={18} />}<span>{children}</span></div>
      {action}
    </div>
  );
}

export function EmptyState({ title, children }) {
  return (
    <div className="list-row stack" style={{ placeItems: 'start' }}>
      <strong>{title}</strong>
      {children && <span className="secondary">{children}</span>}
    </div>
  );
}
