'use client';

import 'leaflet/dist/leaflet.css';
import { useRouter } from 'next/navigation';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import { ECOSYSTEM_LABELS } from '@/lib/utils';
import type { ObservationSummary, EcosystemCode } from '@/lib/types';

const ECOSYSTEM_COLOR_VAR: Record<EcosystemCode, string> = {
  mangrove: '--chart-mangrove',
  seagrass: '--chart-seagrass',
  salt_marsh: '--chart-saltmarsh',
};

export function MapView({ observations }: { observations: ObservationSummary[] }) {
  const router = useRouter();
  const center: [number, number] =
    observations.length > 0
      ? [observations[0].latitude, observations[0].longitude]
      : [20.5937, 78.9629]; // India, sane default when there's no data yet

  return (
    <MapContainer center={center} zoom={observations.length > 0 ? 6 : 4} className="h-full w-full" scrollWheelZoom>
      <TileLayer
        // Esri's World Street Map (env-overridable) rather than the stock OSM style - stock
        // OSM renders each region's local-language place names, which reads as broken for an
        // audience expecting English throughout. Two earlier picks didn't hold up: CARTO's
        // rastertiles turned out to need an API key, and Wikimedia's "osm-intl" still mixes in
        // local script for country/city names despite the name. Esri's global basemap is
        // designed for English-only labeling and needs no key.
        attribution='Tiles &copy; Esri &mdash; Source: Esri, HERE, Garmin, FAO, NOAA, USGS'
        url={
          process.env.NEXT_PUBLIC_MAP_TILE_URL ||
          'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}'
        }
      />
      {observations.map((obs) => (
        <CircleMarker
          key={obs.id}
          center={[obs.latitude, obs.longitude]}
          radius={8}
          pathOptions={{
            color: `hsl(var(${ECOSYSTEM_COLOR_VAR[obs.ecosystem_code]}))`,
            fillColor: `hsl(var(${ECOSYSTEM_COLOR_VAR[obs.ecosystem_code]}))`,
            fillOpacity: 0.75,
            weight: 2,
          }}
          eventHandlers={{ click: () => router.push(`/observations/${obs.id}`) }}
        >
          <Popup>
            <p className="text-sm font-medium">{ECOSYSTEM_LABELS[obs.ecosystem_code]}</p>
            <p className="text-xs text-ink-faint">
              {obs.latitude.toFixed(4)}, {obs.longitude.toFixed(4)}
            </p>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
