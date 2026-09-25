import { useEffect, useRef, useState } from 'react';
import { Heart, RotateCcw, SkipForward, UtensilsCrossed, WifiOff, X } from 'lucide-react';
import { fetchRandomRecipe } from '../recipeApi.js';
import { IconButton } from './ui.jsx';

const SWIPE_THRESHOLD = 90;
// Matches --t-slow so the exit animation finishes before the next card mounts.
const EXIT_MS = 320;
// Give up silently re-rolling an already-decided recipe after this many tries
// in a row, so a near-exhausted deck can't loop forever without showing a card.
const MAX_REROLLS = 5;

function SwipeCard({ item, onDecide }) {
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [exiting, setExiting] = useState(null);
  const [imageOk, setImageOk] = useState(true);
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

  const rotate = Math.max(-14, Math.min(14, dragX / 12));
  const style = exiting ? undefined : { transform: `translateX(${dragX}px) rotate(${rotate}deg)` };
  const exitClass = exiting ? `exit-${exiting}` : '';
  const subtitle = [item.area, item.category].filter(Boolean).join(' · ');

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
      <div className="swipe-card-image-wrap">
        {item.image && imageOk
          ? <img className="swipe-card-image" src={item.image} alt="" draggable={false} onError={() => setImageOk(false)} />
          : <span className="swipe-card-icon"><UtensilsCrossed aria-hidden="true" /></span>}
      </div>
      <div className="swipe-card-body">
        <strong className="swipe-card-name font-display">{item.name}</strong>
        {subtitle && <span className="muted">{subtitle}</span>}
      </div>
    </div>
  );
}

/**
 * A Tinder-style card deck of real recipes fetched live from recipeApi.js —
 * one request per card, only while this is mounted. `decided` is the set of
 * lower-cased names already in favoriteFoods/dislikedFoods so a recipe
 * already answered for isn't asked again. `onDecide(item, direction)` fires
 * once per card with direction 'like' | 'dislike' | 'skip'; only `item.name`
 * is ever persisted by the caller — the photo is never stored.
 */
export default function FoodSwiper({ decided, onDecide }) {
  const [status, setStatus] = useState('loading');
  const [recipe, setRecipe] = useState(null);
  const [count, setCount] = useState(0);
  const [announcement, setAnnouncement] = useState('');
  const liveRef = useRef(false);

  const load = async () => {
    setStatus('loading');
    let next = null;
    for (let attempt = 0; attempt < MAX_REROLLS; attempt += 1) {
      try {
        next = await fetchRandomRecipe();
      } catch {
        if (!liveRef.current) return;
        setStatus('error');
        return;
      }
      if (!liveRef.current) return;
      if (!decided.has(next.name.toLowerCase())) break;
      // Already decided — reroll, unless this was the last attempt, in which
      // case show it anyway rather than leaving the previous card on screen.
    }
    setRecipe(next);
    setStatus('ready');
  };

  useEffect(() => {
    liveRef.current = true;
    load();
    return () => { liveRef.current = false; };
    // Only the first card should load on mount; advance() drives every card after that.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const advance = (decidedItem, direction) => {
    onDecide(decidedItem, direction);
    setCount((n) => n + 1);
    setAnnouncement(direction === 'like' ? `${decidedItem.name} added to loved foods` : direction === 'dislike' ? `${decidedItem.name} added to disliked foods` : `${decidedItem.name} skipped`);
    load();
  };

  if (status === 'error') {
    return (
      <div className="swipe-done">
        <WifiOff size={28} aria-hidden="true" className="tone-warn" />
        <strong>Couldn't reach the recipe database.</strong>
        <span className="muted">Check your connection, then try again.</span>
        <button className="btn-secondary" type="button" onClick={load}><RotateCcw size={16} aria-hidden="true" /> Retry</button>
      </div>
    );
  }

  return (
    <>
      <div className="swipe-progress">
        <span>{count} swiped</span>
      </div>
      <div className="swipe-stack">
        {status === 'loading' && <div className="swipe-card loading" aria-hidden="true" />}
        {status === 'ready' && recipe && <SwipeCard key={recipe.id} item={recipe} onDecide={advance} />}
      </div>
      <div className="swipe-actions" role="group" aria-label="Rate this recipe">
        <IconButton label="Not for me" className="btn-icon swipe-action dislike" disabled={status !== 'ready'} onClick={() => advance(recipe, 'dislike')}><X aria-hidden="true" /></IconButton>
        <IconButton label="Skip" className="btn-icon" disabled={status !== 'ready'} onClick={() => advance(recipe, 'skip')}><SkipForward size={18} aria-hidden="true" /></IconButton>
        <IconButton label="Love it" className="btn-icon swipe-action like" disabled={status !== 'ready'} onClick={() => advance(recipe, 'like')}><Heart aria-hidden="true" /></IconButton>
      </div>
      <span className="sr-only" aria-live="polite">{status === 'loading' ? 'Loading the next recipe…' : announcement}</span>
    </>
  );
}
