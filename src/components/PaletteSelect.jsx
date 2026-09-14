import { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

// Swatches read the real palette tokens by scoping data-palette onto the element.
function Swatches({ id, theme }) {
  return (
    <span className="swatches" data-palette={id} data-theme={theme} aria-hidden="true">
      <i style={{ background: 'var(--accent)' }} />
      <i style={{ background: 'var(--accent-2)' }} />
      <i style={{ background: 'var(--accent-3)' }} />
      <i style={{ background: 'var(--accent-4)' }} />
    </span>
  );
}

export default function PaletteSelect({ palettes, value, onChange, theme = 'dark', label = 'Colour palette' }) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(() => Math.max(0, palettes.findIndex((item) => item.id === value)));
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const listRef = useRef(null);
  const listId = useId();
  const current = palettes.find((item) => item.id === value) ?? palettes[0];

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    listRef.current?.focus();
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [open]);

  useEffect(() => {
    if (open) listRef.current?.querySelector(`[data-index="${activeIndex}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [open, activeIndex]);

  const openList = () => {
    setActiveIndex(Math.max(0, palettes.findIndex((item) => item.id === value)));
    setOpen(true);
  };

  const choose = (index) => {
    onChange(palettes[index].id);
    setOpen(false);
    buttonRef.current?.focus();
  };

  const onListKey = (event) => {
    if (event.key === 'ArrowDown') setActiveIndex((index) => Math.min(palettes.length - 1, index + 1));
    else if (event.key === 'ArrowUp') setActiveIndex((index) => Math.max(0, index - 1));
    else if (event.key === 'Home') setActiveIndex(0);
    else if (event.key === 'End') setActiveIndex(palettes.length - 1);
    else if (event.key === 'Enter' || event.key === ' ') choose(activeIndex);
    else if (event.key === 'Escape' || event.key === 'Tab') {
      // Keep Escape from also closing an enclosing modal.
      event.stopPropagation();
      setOpen(false);
      if (event.key === 'Escape') buttonRef.current?.focus();
      return;
    } else return;
    event.preventDefault();
  };

  return (
    <div className="select-menu" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className="select-trigger input"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={`${label}: ${current.name}`}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            openList();
          }
        }}
      >
        <Swatches id={current.id} theme={theme} />
        <span className="select-trigger-label">{current.name}</span>
        <ChevronDown size={18} className={`select-chevron ${open ? 'open' : ''}`} aria-hidden="true" />
      </button>
      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          tabIndex={-1}
          aria-label={label}
          aria-activedescendant={`${listId}-${activeIndex}`}
          className="select-list card-raised"
          onKeyDown={onListKey}
        >
          {palettes.map((item, index) => (
            <li
              key={item.id}
              id={`${listId}-${index}`}
              data-index={index}
              role="option"
              aria-selected={item.id === value}
              className={`select-option ${index === activeIndex ? 'active' : ''}`}
              onPointerEnter={() => setActiveIndex(index)}
              onClick={() => choose(index)}
            >
              <Swatches id={item.id} theme={theme} />
              <span className="select-option-text">
                <strong>{item.name}</strong>
                <span>{item.description}</span>
              </span>
              {item.id === value && <Check size={16} className="select-check" aria-hidden="true" />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
