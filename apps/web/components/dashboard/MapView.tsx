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
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
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
