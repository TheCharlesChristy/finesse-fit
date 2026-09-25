import { useEffect, useRef, useState } from 'react';
import { Carrot, Cherry, Coffee, Cookie, Drumstick, Heart, Milk, SkipForward, Wheat, X } from 'lucide-react';
import { IconButton, Meter } from './ui.jsx';

const CATEGORY_ICONS = { protein: Drumstick, carb: Wheat, veg: Carrot, fruit: Cherry, sweet: Cookie, dairy: Milk, other: Coffee };
const SWIPE_THRESHOLD = 90;
// Matches --t-slow so the exit animation finishes before the next card mounts.
const EXIT_MS = 320;

function SwipeCard({ item, onDecide }) {
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [exiting, setExiting] = useState(null);
  const startXRef = useRef(0);
  const dragXRef = useRef(0);

  const commit = (direction) => {
    setDragging(false);
    setExiting(direction);
    setTimeout(() => onDecide(item, direction), EXIT_MS);
  };

  useEffect(() => {
    if (!dragging) return undefined;
    const onMove = (event) => {
      const dx = event.clientX - startXRef.current;
      dragXRef.current = dx;
      setDragX(dx);
    };
    const onUp = () => {
      const dx = dragXRef.current;
      if (dx > SWIPE_THRESHOLD) commit('like');
      else if (dx < -SWIPE_THRESHOLD) commit('dislike');
      else {
        setDragging(false);
        setDragX(0);
      }
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  });

  const onKeyDown = (event) => {
    if (event.key === 'ArrowRight') commit('like');
    else if (event.key === 'ArrowLeft') commit('dislike');
    else if (event.key === 'ArrowDown' || event.key === ' ') commit('skip');
    else return;
    event.preventDefault();
  };

  const Icon = CATEGORY_ICONS[item.category] ?? Coffee;
  const rotate = Math.max(-14, Math.min(14, dragX / 12));
  const style = exiting
    ? undefined
    : { transform: `translateX(${dragX}px) rotate(${rotate}deg)` };
  const exitClass = exiting ? `exit-${exiting}` : '';

  return (
    <div
      className={`swipe-card top ${dragging ? 'dragging' : ''} ${exitClass}`.trim()}
      style={style}
      role="group"
      aria-label={item.name}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onPointerDown={(event) => {
        startXRef.current = event.clientX;
        dragXRef.current = 0;
        setDragging(true);
      }}
    >
      {dragX > 24 && <span className="swipe-badge like">Love it</span>}
      {dragX < -24 && <span className="swipe-badge dislike">Not for me</span>}
      <span className="swipe-card-icon"><Icon aria-hidden="true" /></span>
      <strong className="swipe-card-name font-display">{item.name}</strong>
    </div>
  );
}

/**
 * A Tinder-style card deck: drag (pointer events) or tap the buttons below to
 * sort each food into loved/disliked/skipped. `items` is read once on mount —
 * the parent should not reshuffle it while this is mounted. `onDecide(item,
 * direction)` fires once per card with direction 'like' | 'dislike' | 'skip'.
 */
export default function FoodSwiper({ items, onDecide }) {
  const [index, setIndex] = useState(0);
  const [announcement, setAnnouncement] = useState('');
  const total = items.length;
  const item = items[index];

  const advance = (decided, direction) => {
    onDecide(decided, direction);
    setAnnouncement(direction === 'like' ? `${decided.name} added to loved foods` : direction === 'dislike' ? `${decided.name} added to disliked foods` : `${decided.name} skipped`);
    setIndex((current) => current + 1);
  };

  if (!item) {
    return (
      <div className="swipe-done">
        <Heart size={28} aria-hidden="true" className="tone-good" />
        <strong>That's every food in the deck.</strong>
        <span className="muted">Add anything else below, or move on.</span>
      </div>
    );
  }

  return (
    <>
      <div className="swipe-progress">
        <span>{index + 1} of {total}</span>
        <Meter value={index} max={total} thin label={`Food ${index + 1} of ${total}`} />
      </div>
      <div className="swipe-stack">
        {items[index + 2] && <div className="swipe-card peek-2" aria-hidden="true" />}
        {items[index + 1] && <div className="swipe-card peek-1" aria-hidden="true" />}
        <SwipeCard key={item.name} item={item} onDecide={advance} />
      </div>
      <div className="swipe-actions" role="group" aria-label="Rate this food">
        <IconButton label={`${item.name}: not for me`} className="btn-icon swipe-action dislike" onClick={() => advance(item, 'dislike')}><X aria-hidden="true" /></IconButton>
        <IconButton label={`Skip ${item.name}`} className="btn-icon" onClick={() => advance(item, 'skip')}><SkipForward size={18} aria-hidden="true" /></IconButton>
        <IconButton label={`${item.name}: love it`} className="btn-icon swipe-action like" onClick={() => advance(item, 'like')}><Heart aria-hidden="true" /></IconButton>
      </div>
      <span className="sr-only" aria-live="polite">{announcement}</span>
    </>
  );
}
