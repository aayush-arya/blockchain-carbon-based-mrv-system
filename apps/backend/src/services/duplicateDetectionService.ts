import { sql, type SqlBool } from 'kysely';
import { env } from '../config/env';
import { db } from '../db/client';
import { geographySelect, withinMeters } from '../db/geo';

export interface DuplicateSignal {
  type: 'exact_evidence_hash' | 'geo_time_proximity';
  matchedMrvId: string;
  matchedMrvCode: string;
  matchedObservationId: string;
  detail: string;
}

/**
 * Multi-signal duplicate detection, run once an MRV record has an AI analysis and is about to
 * move to pending_validation. Two independent signals, either of which is enough to flag:
 *
 *   1. Exact evidence hash match against another observation that already has an MRV record.
 *   2. Geospatial + time proximity: a same-ecosystem observation within
 *      DUPLICATE_PROXIMITY_METERS and DUPLICATE_TIME_WINDOW_HOURS that also already has an
 *      MRV record - i.e. someone may have re-photographed roughly the same patch.
 *
 * This flags for human review; it does not block submission (see docs/ARCHITECTURE.md - the
 * validator, not the algorithm, makes the final call).
 */
export async function detectDuplicates(observationId: string): Promise<DuplicateSignal[]> {
  const observation = await db
    .selectFrom('field_observations')
    .select(['id', 'ecosystem_type_id', 'captured_at', 'contributor_id'])
    .where('id', '=', observationId)
    .executeTakeFirstOrThrow();

  const signals: DuplicateSignal[] = [];
  const seenMrvIds = new Set<string>();

  const exactHashMatches = await db
    .selectFrom('evidence_files as e1')
    .innerJoin('evidence_files as e2', (join) =>
      join.onRef('e1.sha256_hash', '=', 'e2.sha256_hash').on('e2.observation_id', '!=', observationId)
    )
    .innerJoin('mrv_records', 'mrv_records.observation_id', 'e2.observation_id')
    .select(['e2.observation_id as observation_id', 'mrv_records.id as mrv_id', 'mrv_records.mrv_code as mrv_code'])
    .where('e1.observation_id', '=', observationId)
    .execute();

  for (const match of exactHashMatches) {
    if (seenMrvIds.has(match.mrv_id)) continue;
    seenMrvIds.add(match.mrv_id);
    signals.push({
      type: 'exact_evidence_hash',
      matchedMrvId: match.mrv_id,
      matchedMrvCode: match.mrv_code ?? match.mrv_id,
      matchedObservationId: match.observation_id,
      detail: `Evidence hash matches ${match.mrv_code ?? match.mrv_id}.`,
    });
  }

  const origin = await getObservationLatLng(observationId);

  const proximityMatches = await db
    .selectFrom('field_observations')
    .innerJoin('mrv_records', 'mrv_records.observation_id', 'field_observations.id')
    .select([
      'field_observations.id as observation_id',
      'mrv_records.id as mrv_id',
      'mrv_records.mrv_code as mrv_code',
      'field_observations.captured_at as captured_at',
    ])
    .where('field_observations.id', '!=', observationId)
    .where('field_observations.ecosystem_type_id', '=', observation.ecosystem_type_id)
    .where(withinMeters('field_observations.location', origin, env.DUPLICATE_PROXIMITY_METERS))
    .where(
      sql<SqlBool>`ABS(EXTRACT(EPOCH FROM (field_observations.captured_at - ${observation.captured_at.toISOString()}::timestamptz))) <= ${env.DUPLICATE_TIME_WINDOW_HOURS * 3600}`
    )
    .execute();

  for (const match of proximityMatches) {
    if (seenMrvIds.has(match.mrv_id)) continue;
    seenMrvIds.add(match.mrv_id);
    const hoursApart = Math.abs(
      (observation.captured_at.getTime() - match.captured_at.getTime()) / (1000 * 60 * 60)
    ).toFixed(1);
    signals.push({
      type: 'geo_time_proximity',
      matchedMrvId: match.mrv_id,
      matchedMrvCode: match.mrv_code ?? match.mrv_id,
      matchedObservationId: match.observation_id,
      detail: `Same ecosystem type within ${env.DUPLICATE_PROXIMITY_METERS}m and ${hoursApart}h of ${match.mrv_code ?? match.mrv_id}.`,
    });
  }

  return signals;
}

async function getObservationLatLng(observationId: string): Promise<{ latitude: number; longitude: number }> {
  const row = await db
    .selectFrom('field_observations')
    .select([geographySelect.latitude.as('latitude'), geographySelect.longitude.as('longitude')])
    .where('id', '=', observationId)
    .executeTakeFirstOrThrow();
  return { latitude: row.latitude, longitude: row.longitude };
}
