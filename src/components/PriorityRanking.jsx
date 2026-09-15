import { useEffect, useRef, useState } from 'react';
import { GripVertical } from 'lucide-react';
import { TRAINING_PRIORITIES } from '../utils.js';

const byId = Object.fromEntries(TRAINING_PRIORITIES.map((priority) => [priority.id, priority]));

// Drag the grip (mouse or touch) or focus it and use the arrow keys to reorder.
// `priorities` is the ordered id list, most important first.
export default function PriorityRanking({ priorities, onChange }) {
  const listRef = useRef(null);
  const handleRefs = useRef({});
  const orderRef = useRef(priorities);
  const [dragging, setDragging] = useState(null);
  const [focusId, setFocusId] = useState(null);
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    orderRef.current = priorities;
  }, [priorities]);

  const move = (id, to) => {
    const order = orderRef.current;
    const from = order.indexOf(id);
    if (to < 0 || to >= order.length || to === from) return false;
    const next = [...order];
    next.splice(from, 1);
    next.splice(to, 0, id);
    orderRef.current = next;
    onChange(next);
    setAnnouncement(`${byId[id].label} moved to ${to + 1} of ${next.length}`);
    return true;
  };

  // Reordering moves DOM nodes, which can drop focus — put it back on the moved handle.
  useEffect(() => {
    if (focusId) handleRefs.current[focusId]?.focus();
  }, [priorities, focusId]);

  useEffect(() => {
    if (!dragging) return undefined;
    // Listen on window: the dragged row's node is moved as the order changes,
    // so events targeted at the handle itself aren't reliable mid-drag.
    const onMove = (event) => {
      // The new slot is how many other rows' midpoints the pointer is below, so
      // a fast drag that fires few move events still lands in the right place.
      const others = [...(listRef.current?.children ?? [])].filter((row) => row.dataset.id !== dragging);
      const to = others.filter((row) => { const rect = row.getBoundingClientRect(); return event.clientY > rect.top + rect.height / 2; }).length;
      move(dragging, to);
    };
    const onEnd = () => setDragging(null);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onEnd);
    window.addEventListener('pointercancel', onEnd);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onEnd);
      window.removeEventListener('pointercancel', onEnd);
    };
  });

  const onKeyDown = (event, id) => {
    const index = orderRef.current.indexOf(id);
    const to = event.key === 'ArrowUp' ? index - 1 : event.key === 'ArrowDown' ? index + 1 : event.key === 'Home' ? 0 : event.key === 'End' ? orderRef.current.length - 1 : null;
    if (to == null) return;
    event.preventDefault();
    setFocusId(id);
    move(id, to);
  };

  return (
    <>
      <ol ref={listRef} className="priority-list">
        {priorities.map((id, index) => (
          <li key={id} data-id={id} className={`priority-row ${dragging === id ? 'dragging' : ''}`}>
            <span className="priority-rank" aria-hidden="true">{index + 1}</span>
            <div className="priority-text">
              <strong>{byId[id].label}</strong>
              <span className="muted">{byId[id].effect}</span>
            </div>
            <button
              ref={(node) => { handleRefs.current[id] = node; }}
              type="button"
              className="btn-icon btn-icon-quiet priority-handle"
              aria-label={`${byId[id].label}, priority ${index + 1} of ${priorities.length}. Use arrow keys to reorder.`}
              title="Drag to reorder"
              onPointerDown={(event) => { event.preventDefault(); setFocusId(null); setDragging(id); }}
              onKeyDown={(event) => onKeyDown(event, id)}
            >
              <GripVertical size={18} />
            </button>
          </li>
        ))}
      </ol>
      <span className="sr-only" aria-live="polite">{announcement}</span>
    </>
  );
}
