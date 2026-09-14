// Leaflet and its stylesheet, only ever reached through a dynamic import() from
// RouteMap — most sessions never open a map, so neither sits in the main bundle.
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export default L;
