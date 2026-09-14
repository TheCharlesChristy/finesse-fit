import { useEffect, useMemo, useRef, useState } from 'react';
import { Crosshair, LoaderCircle, Play, Repeat2, RotateCcw, Save, Trash2, Undo2 } from 'lucide-react';
import { fmtDistance, haversine, pathDistance } from '../geo.js';
import { routeLeg } from '../routingApi.js';
import RouteMap from './RouteMap.jsx';
import { getCurrentFix, locationAlreadyAllowed } from './useGeolocation.js';
import { Toggle } from './inputs.jsx';
import { Field, Modal } from './ui.jsx';

const legKey = (a, b, follow) => `${follow ? 'p' : 's'}:${a[0]},${a[1]}>${b[0]},${b[1]}`;
const straight = (a, b) => ({ path: [a, b], distance: haversine(a, b), routed: false });

export default function RoutePlannerModal({ route, defaultCenter, units, onClose, onSave, onDelete, onRun, onNotice }) {
  const [name, setName] = useState(route?.name ?? '');
  const [waypoints, setWaypoints] = useState(route?.waypoints?.length ? route.waypoints : []);
  const [followPaths, setFollowPaths] = useState(route?.followPaths ?? true);
  const [legs, setLegs] = useState({});
  const [pending, setPending] = useState(0);
  const [position, setPosition] = useState(null);
  const [center, setCenter] = useState(() => (!route && defaultCenter ? [defaultCenter[0], defaultCenter[1], 14] : null));
  const [locating, setLocating] = useState(false);
  const [cleared, setCleared] = useState(false);
  const [initial] = useState(() => JSON.stringify({ name, waypoints, followPaths }));
  const legsRef = useRef(legs);
  const noticeRef = useRef(onNotice);
  useEffect(() => {
    legsRef.current = legs;
    noticeRef.current = onNotice;
  });
  const dirty = cleared || JSON.stringify({ name, waypoints, followPaths }) !== initial;
  // A route saved from a recorded run has a path but no waypoints: keep showing its path until it's edited.
  const legacyPath = !cleared && !waypoints.length && route?.path?.length ? route.path : null;

  // Route each new leg once, one request at a time (the public server is for
  // light use), falling back to a straight line if it can't be reached. Only
  // a change to the points restarts this — arriving legs don't.
  useEffect(() => {
    const missing = [];
    for (let i = 1; i < waypoints.length; i += 1) {
      const key = legKey(waypoints[i - 1], waypoints[i], followPaths);
      if (!legsRef.current[key]) missing.push([key, waypoints[i - 1], waypoints[i]]);
    }
    if (!missing.length) return undefined;
    if (!followPaths) {
      setLegs((current) => ({ ...current, ...Object.fromEntries(missing.map(([key, a, b]) => [key, straight(a, b)])) }));
      return undefined;
    }
    const abort = new AbortController();
    (async () => {
      setPending(missing.length);
      let warned = false;
      for (const [key, a, b] of missing) {
        let leg;
        try {
          leg = { ...(await routeLeg(a, b, { signal: abort.signal })), routed: true };
        } catch (error) {
          if (abort.signal.aborted) return;
          leg = straight(a, b);
          if (!warned) noticeRef.current?.(error.message);
          warned = true;
        }
        if (abort.signal.aborted) return;
        setLegs((current) => ({ ...current, [key]: leg }));
        setPending((count) => Math.max(0, count - 1));
      }
    })();
    return () => {
      abort.abort();
      setPending(0);
    };
  }, [waypoints, followPaths]);

  useEffect(() => {
    if (route || defaultCenter) return;
    locationAlreadyAllowed().then((allowed) => allowed && getCurrentFix().then((fix) => {
      setPosition([fix[0], fix[1], fix[3]]);
      setCenter([fix[0], fix[1], 15]);
    }).catch(() => {}));
  }, [route, defaultCenter]);

  const { path, distance } = useMemo(() => {
    if (legacyPath) return { path: legacyPath, distance: route.distance || pathDistance(legacyPath) };
    const joined = [];
    let total = 0;
    for (let i = 1; i < waypoints.length; i += 1) {
      const leg = legs[legKey(waypoints[i - 1], waypoints[i], followPaths)] ?? straight(waypoints[i - 1], waypoints[i]);
      joined.push(...(joined.length ? leg.path.slice(1) : leg.path));
      total += leg.distance;
    }
    return { path: joined.length ? joined : waypoints.slice(0, 1), distance: total };
  }, [legacyPath, route, waypoints, legs, followPaths]);

  const round6 = (point) => [Math.round(point[0] * 1e6) / 1e6, Math.round(point[1] * 1e6) / 1e6];
  const addPoint = (point) => setWaypoints((current) => [...current, round6(point)]);
  const movePoint = (index, point) => setWaypoints((current) => current.map((item, i) => (i === index ? round6(point) : item)));
  const [fitKey] = useState(() => (route ? 'fit' : undefined));

  const locate = async () => {
    setLocating(true);
    try {
      const fix = await getCurrentFix();
      setPosition([fix[0], fix[1], fix[3]]);
      setCenter([fix[0], fix[1], 16]);
    } catch (error) {
      onNotice?.(error.message);
    } finally {
      setLocating(false);
    }
  };

  const canSave = path.length > 1 && distance > 0 && !pending;
  const save = (options) => canSave && onSave({ ...(route ?? {}), name: name.trim() || `${fmtDistance(distance, units)} route`, waypoints, path, distance, followPaths }, options);

  return (
    <Modal
      title={route?.id ? 'Edit route' : 'Plan a route'}
      size="lg"
      onClose={() => onClose(dirty)}
      onSubmit={() => save()}
      footer={({ formId }) => (
        <>
          {route?.id && onDelete && <button className="btn-danger" type="button" onClick={() => onDelete(route.id)}><Trash2 size={18} aria-hidden="true" /> Delete</button>}
          <span className="spacer" />
          <button className="btn-secondary" type="button" onClick={() => onClose(dirty)}>Cancel</button>
          <button className="btn-secondary" type="submit" form={formId} disabled={!canSave}><Save size={18} aria-hidden="true" /> Save</button>
          {onRun && <button className="btn-primary" type="button" disabled={!canSave} onClick={() => save({ thenRun: true })}><Play size={18} aria-hidden="true" /> Save &amp; run</button>}
        </>
      )}
    >
      <div className="route-planner">
        <RouteMap
          className="route-planner-map"
          label="Route planner map. Tap to add a point."
          planned={path}
          waypoints={waypoints}
          position={position}
          onMapClick={addPoint}
          onWaypointMove={movePoint}
          fitKey={fitKey}
          center={center}
        />
        <div className="route-planner-bar">
          <div className="route-distance">
            <span className="metric">{fmtDistance(distance, units)}</span>
            <span className="muted">{pending ? <><LoaderCircle size={13} className="spin inline-icon" /> finding paths…</> : waypoints.length ? `${waypoints.length} point${waypoints.length === 1 ? '' : 's'}` : 'Tap the map to start'}</span>
          </div>
          <div className="row route-tools">
            <button type="button" className="btn-icon" title="Locate me" aria-label="Locate me" onClick={locate} disabled={locating}>{locating ? <LoaderCircle size={17} className="spin" /> : <Crosshair size={17} />}</button>
            <button type="button" className="btn-icon" title="Undo last point" aria-label="Undo last point" disabled={!waypoints.length} onClick={() => setWaypoints((current) => current.slice(0, -1))}><Undo2 size={17} /></button>
            <button type="button" className="btn-icon" title="Back to start" aria-label="Finish the loop back at the start" disabled={waypoints.length < 2} onClick={() => addPoint(waypoints[0])}><Repeat2 size={17} /></button>
            <button type="button" className="btn-icon" title="Reverse direction" aria-label="Reverse direction" disabled={waypoints.length < 2} onClick={() => setWaypoints((current) => current.slice().reverse())}><RotateCcw size={17} /></button>
            <button type="button" className="btn-icon" title="Clear" aria-label="Clear all points" disabled={!waypoints.length && !legacyPath} onClick={() => { setWaypoints([]); setCleared(true); }}><Trash2 size={17} /></button>
          </div>
        </div>
      </div>
      <div className="form-grid">
        <Field label="Name"><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="River loop" autoCapitalize="sentences" /></Field>
        <Toggle checked={followPaths} onChange={setFollowPaths} hint="Snaps each leg to streets and footpaths. Sends only the two points being joined to OpenStreetMap’s routing service.">Follow paths</Toggle>
      </div>
      <span className="muted map-privacy">Map images come from OpenStreetMap, which sees the area you’re viewing. Your saved routes and runs stay on this device.</span>
    </Modal>
  );
}
