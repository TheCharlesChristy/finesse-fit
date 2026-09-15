import { useEffect, useRef, useState } from 'react';
import { LoaderCircle, WifiOff } from 'lucide-react';
import { TILE_ATTRIBUTION, TILE_MAX_ZOOM, TILE_URL } from '../mapTiles.js';

// A thin imperative wrapper over Leaflet. Every line/marker is styled by class
// in index.css (stroke: var(--accent) etc.), so maps follow the palette and
// theme like everything else — no colours are passed to Leaflet.
//
// props:
//   planned    [[lat, lon]]            a route to follow (dashed)
//   track      [[[lat, lon]]]          recorded segments
//   position   [lat, lon, accuracy]    live location dot
//   waypoints  [[lat, lon]]            draggable planner markers
//   onMapClick([lat, lon]) / onWaypointMove(index, [lat, lon])
//   follow     keep the live dot centred
//   fitKey     change it to re-fit the view to the lines on the map
//   center     [lat, lon, zoom] to jump to when it changes
export default function RouteMap({ planned, track, position, waypoints, onMapClick, onWaypointMove, follow = false, fitKey, center, className = '', label = 'Map' }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const leafletRef = useRef(null);
  const layersRef = useRef({});
  const handlers = useRef({ onMapClick, onWaypointMove });
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [offline, setOffline] = useState(() => typeof navigator !== 'undefined' && navigator.onLine === false);
  useEffect(() => { handlers.current = { onMapClick, onWaypointMove }; });

  useEffect(() => {
    let disposed = false;
    let observer = null;
    import('./leaflet.js').then(({ default: L }) => {
      if (disposed || !containerRef.current) return;
      leafletRef.current = L;
      const map = L.map(containerRef.current, { zoomControl: true, attributionControl: true, worldCopyJump: true }).setView([30, 0], 2);
      L.tileLayer(TILE_URL, { maxZoom: TILE_MAX_ZOOM, attribution: TILE_ATTRIBUTION, className: 'map-tiles', crossOrigin: true }).addTo(map);
      map.attributionControl.setPrefix(false);
      map.on('click', (event) => handlers.current.onMapClick?.([event.latlng.lat, event.latlng.lng]));
      mapRef.current = map;
      // Maps inside modals/sheets get their real size after the open animation.
      observer = new ResizeObserver(() => map.invalidateSize());
      observer.observe(containerRef.current);
      setReady(true);
    }).catch(() => !disposed && setFailed(true));
    const onNetwork = () => setOffline(navigator.onLine === false);
    window.addEventListener('online', onNetwork);
    window.addEventListener('offline', onNetwork);
    return () => {
      disposed = true;
      observer?.disconnect();
      window.removeEventListener('online', onNetwork);
      window.removeEventListener('offline', onNetwork);
      mapRef.current?.remove();
      mapRef.current = null;
      layersRef.current = {};
    };
  }, []);

  // Replace one named layer (or group) whenever its data changes.
  const setLayer = (name, build) => {
    const map = mapRef.current;
    if (!map) return;
    layersRef.current[name]?.remove();
    const layer = build?.(leafletRef.current);
    layersRef.current[name] = layer ?? null;
    layer?.addTo(map);
  };

  useEffect(() => {
    if (!ready) return;
    setLayer('planned', planned?.length > 1 ? (L) => L.polyline(planned, { className: 'map-line-planned', weight: 5, interactive: false }) : null);
  }, [ready, planned]);

  useEffect(() => {
    if (!ready) return;
    const lines = (track ?? []).filter((segment) => segment.length > 1);
    setLayer('track', lines.length ? (L) => L.featureGroup([
      L.polyline(lines, { className: 'map-line-track-casing', weight: 8, interactive: false }),
      L.polyline(lines, { className: 'map-line-track', weight: 4, interactive: false }),
      L.circleMarker(lines[0][0], { className: 'map-start', radius: 6, weight: 3, interactive: false })
    ]) : null);
  }, [ready, track]);

  useEffect(() => {
    if (!ready) return;
    setLayer('waypoints', waypoints?.length ? (L) => L.featureGroup(waypoints.map((point, index) => {
      const isLoopEnd = index === waypoints.length - 1 && index > 0;
      const marker = L.marker(point, {
        draggable: Boolean(handlers.current.onWaypointMove),
        keyboard: false,
        icon: L.divIcon({ className: `map-waypoint ${index === 0 ? 'start' : isLoopEnd ? 'end' : ''}`, html: `<span>${index === 0 ? 'S' : index + 1}</span>`, iconSize: [26, 26], iconAnchor: [13, 13] })
      });
      marker.on('dragend', () => {
        const { lat, lng } = marker.getLatLng();
        handlers.current.onWaypointMove?.(index, [lat, lng]);
      });
      return marker;
    })) : null);
  }, [ready, waypoints]);

  useEffect(() => {
    if (!ready) return;
    setLayer('position', position ? (L) => L.featureGroup([
      L.circle([position[0], position[1]], { radius: position[2] ?? 10, className: 'map-accuracy', weight: 1, interactive: false }),
      L.circleMarker([position[0], position[1]], { radius: 7, className: 'map-position', weight: 3, interactive: false })
    ]) : null);
    if (position && follow) mapRef.current.setView([position[0], position[1]], Math.max(mapRef.current.getZoom(), 16), { animate: true });
  }, [ready, position, follow]);

  useEffect(() => {
    if (!ready || fitKey === undefined) return;
    const L = leafletRef.current;
    const points = [...(planned ?? []), ...(track ?? []).flat(), ...(waypoints ?? [])];
    if (points.length > 1) mapRef.current.fitBounds(L.latLngBounds(points), { padding: [28, 28], maxZoom: 17 });
    else if (points.length === 1) mapRef.current.setView(points[0], 16);
    // Only a fitKey change should re-fit; data updates alone must not yank the view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, fitKey]);

  useEffect(() => {
    if (ready && center) mapRef.current.setView([center[0], center[1]], center[2] ?? 15);
  }, [ready, center]);

  return (
    <div className={`route-map ${className}`}>
      <div ref={containerRef} className="route-map-canvas" role="application" aria-label={label} />
      {!ready && !failed && <div className="route-map-status"><LoaderCircle size={18} className="spin" /> Loading map…</div>}
      {failed && <div className="route-map-status">The map couldn’t load. Your activity data is unaffected.</div>}
      {ready && offline && <div className="route-map-offline"><WifiOff size={14} /> Offline — map images unavailable</div>}
    </div>
  );
}
