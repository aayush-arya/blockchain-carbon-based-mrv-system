import { sql } from 'kysely';

export interface LatLng {
  latitude: number;
  longitude: number;
}

/** Builds the `ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography` insert expression. */
export function toGeographyPoint({ latitude, longitude }: LatLng) {
  if (latitude < -90 || latitude > 90) {
    throw new RangeError(`latitude ${latitude} out of range [-90, 90]`);
  }
  if (longitude < -180 || longitude > 180) {
    throw new RangeError(`longitude ${longitude} out of range [-180, 180]`);
  }
  return sql`ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography`;
}

/** Select fragments that unpack a geography column back into plain lat/lng numbers. */
export const geographySelect = {
  latitude: sql<number>`ST_Y(location::geometry)`,
  longitude: sql<number>`ST_X(location::geometry)`,
};

/** Meters-based radius filter, for "observations near a coordinate" queries. */
export function withinMeters(column: string, center: LatLng, radiusMeters: number) {
  return sql`ST_DWithin(${sql.ref(column)}, ${toGeographyPoint(center)}, ${radiusMeters})`;
}

/** Bounding-box filter, for "observations within geographic bounds" map-viewport queries. */
export function withinBoundingBox(
  column: string,
  bounds: { minLat: number; minLng: number; maxLat: number; maxLng: number }
) {
  return sql`${sql.ref(column)}::geometry && ST_MakeEnvelope(${bounds.minLng}, ${bounds.minLat}, ${bounds.maxLng}, ${bounds.maxLat}, 4326)`;
}
