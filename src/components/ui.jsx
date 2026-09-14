import { useEffect, useRef, useState } from 'react';
import { MoreHorizontal, Search, X } from 'lucide-react';
import { useScrollLock } from './useScrollLock.js';

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
// Open modals, newest last. Only the top one reacts to Escape/Tab so a confirm
// dialog stacked on a form does not close both at once.
const modalStack = [];

// size: 'sm' for short single-column forms, 'md' default, 'lg' for editors (workouts, exercises).
export function Modal({ title, children, onClose, size = 'md', large = false, onSubmit }) {
  const boxRef = useRef(null);
  const closeRef = useRef(onClose);
  const pressStartedOnOverlay = useRef(false);

  useEffect(() => {
    closeRef.current = onClose;
  });

  // Pins the body at its scroll offset rather than just hiding overflow, so a
  // touch that starts inside the sheet can't drag the page underneath on iOS.
  useScrollLock();

  useEffect(() => {
    const token = {};
    modalStack.push(token);
    const previous = document.activeElement;
    const box = boxRef.current;
    const body = box?.querySelector('.modal-body');
    const firstField = body?.querySelector('input:not([type="hidden"]):not([type="checkbox"]):not([type="range"]), select, textarea');
    const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches;
    // On touch devices, auto-focusing an input pops the keyboard over the form; focus the dialog instead.
    if (firstField && !coarsePointer) firstField.focus();
    else box?.focus();

    const onKey = (event) => {
      if (modalStack.at(-1) !== token) return;
      if (event.key === 'Escape') {
        // Nested pickers get the first Escape so the parent form remains open.
        if (box?.querySelector('.exercise-picker-popover')) return;
        event.preventDefault();
        closeRef.current?.();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = [...box.querySelectorAll(FOCUSABLE)].filter((item) => !item.disabled && item.offsetParent !== null);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === box)) {
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
      modalStack.splice(modalStack.indexOf(token), 1);
      if (previous?.isConnected) previous.focus?.();
    };
  }, []);

  const Body = onSubmit ? 'form' : 'div';
  const bodyProps = onSubmit ? { onSubmit: (event) => { event.preventDefault(); onSubmit(); }, noValidate: true } : {};

  return (
    <div
      className="modal-overlay"
      role="presentation"
      onMouseDown={(event) => { pressStartedOnOverlay.current = event.target === event.currentTarget; }}
      onClick={(event) => {
        // Only dismiss when the whole click happened on the backdrop, so dragging a text selection out of an input doesn't close the form.
        if (pressStartedOnOverlay.current && event.target === event.currentTarget) onClose?.();
      }}
    >
      <section
        ref={boxRef}
        tabIndex={-1}
        className={`modal-box card-raised stack modal-${large ? 'lg' : size}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="split modal-header">
          <h2 className="font-display modal-title">{title}</h2>
          {onClose && <IconButton label="Close" className="btn-icon btn-icon-quiet" onClick={onClose}><X size={19} /></IconButton>}
        </div>
        <Body className="modal-body stack" {...bodyProps}>{children}</Body>
      </section>
    </div>
  );
}

export function NumberInput({ value, onChange, step = 'any', min = 0, ...props }) {
  // Selecting on focus lets a tap-and-type replace the value instead of appending to it.
  return <input className="input" type="number" inputMode="decimal" step={step} min={min} value={value} onChange={(e) => onChange(e.target.value)} onFocus={(e) => e.target.select()} {...props} />;
}

const whole = (value) => {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

// Minutes + seconds, stored as whole seconds. Two numeric fields beat one
// "m:ss" text box on a phone keyboard, which has no colon on the number pad.
export function DurationInput({ seconds, onChange, label = 'Duration', allowZero = false }) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  const [minutes, setMinutes] = useState(String(Math.floor(total / 60)));
  const [secs, setSecs] = useState(String(total % 60));
  // Resync when the value is changed from outside (a preset chip, a kind switch).
  const [synced, setSynced] = useState(total);
  if (synced !== total && whole(minutes) * 60 + whole(secs) !== total) {
    setSynced(total);
    setMinutes(String(Math.floor(total / 60)));
    setSecs(String(total % 60));
  }
  const emit = (m, s) => {
    const next = whole(m) * 60 + Math.min(59, whole(s));
    // Clearing both fields mid-edit keeps the last real value rather than snapping back.
    if (next <= 0 && !allowZero) return;
    setSynced(next);
    onChange(next);
  };
  return (
    <div className="duration-input" role="group" aria-label={label}>
      <input className="input" type="number" inputMode="numeric" min="0" aria-label={`${label} minutes`} value={minutes} onFocus={(e) => e.target.select()} onChange={(e) => { setMinutes(e.target.value); emit(e.target.value, secs); }} />
      <span aria-hidden="true">min</span>
      <input className="input" type="number" inputMode="numeric" min="0" max="59" aria-label={`${label} seconds`} value={secs} onFocus={(e) => e.target.select()} onChange={(e) => { setSecs(e.target.value); emit(minutes, e.target.value); }} />
      <span aria-hidden="true">sec</span>
    </div>
  );
}

export function Toggle({ checked, onChange, children, hint }) {
  return (
    <label className="toggle-row">
      <input type="checkbox" className="toggle" checked={Boolean(checked)} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle-copy"><span>{children}</span>{hint && <span className="muted">{hint}</span>}</span>
    </label>
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
    <div className="split card-header">
      <div className="card-title">{Icon && <Icon size={18} />}<span>{children}</span></div>
      {action}
    </div>
  );
}

export function PageHeader({ title, subtitle, children }) {
  return (
    <div className="page-header">
      <div>
        <h1 className="font-display page-title">{title}</h1>
        {subtitle && <p className="secondary page-subtitle">{subtitle}</p>}
      </div>
      {children && <div className="row page-actions">{children}</div>}
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder = 'Search', label = placeholder, onEnter }) {
  return (
    <div className="search-input">
      <Search size={17} aria-hidden="true" />
      <input
        className="input"
        type="search"
        enterKeyHint="search"
        aria-label={label}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => { if (event.key === 'Enter' && onEnter) { event.preventDefault(); onEnter(); } }}
      />
    </div>
  );
}

export function EmptyState({ title, children }) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      {children && <span>{children}</span>}
    </div>
  );
}

// Equal-width segmented control, used for tabs and small single choices (meal, theme, units).
export function Segmented({ label, value, options, onChange, hideLabel = false, className = '' }) {
  return (
    <div className={`field ${className}`}>
      {!hideLabel && <span className="field-label">{label}</span>}
      <div className="segmented" role="radiogroup" aria-label={label}>
        {options.map((option) => (
          <button key={option.value} type="button" role="radio" aria-checked={value === option.value} className={value === option.value ? 'active' : ''} onClick={() => onChange(option.value)}>
            {option.icon}
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// "⋯" button with a small action menu. items: [{ label, icon, onSelect, danger }]
export function OverflowMenu({ label = 'More actions', items }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef(null);
  const menuRef = useRef(null);
  const buttonRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    menuRef.current?.querySelectorAll('[role="menuitem"]')[active]?.focus();
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [open, active]);

  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) buttonRef.current?.focus();
  };

  const onKey = (event) => {
    if (event.key === 'ArrowDown') setActive((index) => (index + 1) % items.length);
    else if (event.key === 'ArrowUp') setActive((index) => (index - 1 + items.length) % items.length);
    else if (event.key === 'Escape') {
      // Don't let Escape also close an enclosing modal.
      event.stopPropagation();
      close();
    } else if (event.key === 'Tab') close(false);
    else return;
    if (event.key !== 'Tab') event.preventDefault();
  };

  return (
    <div className="menu-root" ref={rootRef} onClick={(event) => event.stopPropagation()}>
      <button
        ref={buttonRef}
        type="button"
        className="btn-icon btn-icon-quiet"
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => { setActive(0); setOpen(!open); }}
      >
        <MoreHorizontal size={18} />
      </button>
      {open && (
        <div ref={menuRef} role="menu" className="menu card-raised" onKeyDown={onKey}>
          {items.map((item, index) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              tabIndex={index === active ? 0 : -1}
              className={`menu-item ${item.danger ? 'danger' : ''}`}
              onClick={() => { close(false); item.onSelect(); }}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
