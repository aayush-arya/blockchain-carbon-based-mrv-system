import { db } from '../db/client';
import { geographySelect, toGeographyPoint, withinBoundingBox } from '../db/geo';
import type { EcosystemCode } from '../db/types';
import { NotFoundError } from '../utils/errors';
import { buildEvidenceKey, sha256Hex, storage } from './storageService';

export async function resolveEcosystemTypeId(code: EcosystemCode): Promise<string> {
  const row = await db
    .selectFrom('ecosystem_types')
    .select('id')
    .where('code', '=', code)
    .executeTakeFirst();
  if (!row) {
    throw new NotFoundError('Ecosystem type', code);
  }
  return row.id;
}

export interface ExactDuplicateMatch {
  observationId: string;
  evidenceFileId: string;
  uploadedAt: Date;
}

/** Cheap first-line check: identical bytes already submitted. Full multi-signal duplicate
 * detection (geospatial + time proximity across near-but-not-identical evidence) happens at
 * MRV submission time — see duplicateDetectionService. */
export async function findExactHashDuplicate(sha256: string): Promise<ExactDuplicateMatch | null> {
  const row = await db
    .selectFrom('evidence_files')
    .select(['id', 'observation_id', 'uploaded_at'])
    .where('sha256_hash', '=', sha256)
    .orderBy('uploaded_at', 'asc')
    .executeTakeFirst();

  return row ? { observationId: row.observation_id, evidenceFileId: row.id, uploadedAt: row.uploaded_at } : null;
}

export interface CreateObservationInput {
  contributorId: string;
  organizationId: string | null;
  ecosystemCode: EcosystemCode;
  latitude: number;
  longitude: number;
  capturedAt: Date;
  reportedAreaM2: number;
  notes?: string;
  file: { buffer: Buffer; originalname: string; mimetype: string; size: number };
}

export interface CreateObservationResult {
  observationId: string;
  evidenceFileId: string;
  sha256: string;
  duplicateOf: ExactDuplicateMatch | null;
}

export async function createObservation(input: CreateObservationInput): Promise<CreateObservationResult> {
  const ecosystemTypeId = await resolveEcosystemTypeId(input.ecosystemCode);
  const sha256 = sha256Hex(input.file.buffer);
  const duplicateOf = await findExactHashDuplicate(sha256);

  const observation = await db
    .insertInto('field_observations')
    .values({
      contributor_id: input.contributorId,
      organization_id: input.organizationId,
      ecosystem_type_id: ecosystemTypeId,
      location: toGeographyPoint({ latitude: input.latitude, longitude: input.longitude }),
      captured_at: input.capturedAt,
      notes: input.notes ?? null,
      reported_area_m2: input.reportedAreaM2.toString(),
    })
    .returning('id')
    .executeTakeFirstOrThrow();

  const storageKey = buildEvidenceKey(observation.id, input.file.originalname, sha256);
  await storage.upload(storageKey, input.file.buffer, input.file.mimetype);

  const evidence = await db
    .insertInto('evidence_files')
    .values({
      observation_id: observation.id,
      storage_key: storageKey,
      original_filename: input.file.originalname,
      mime_type: input.file.mimetype,
      file_size_bytes: input.file.size.toString(),
      sha256_hash: sha256,
    })
    .returning('id')
    .executeTakeFirstOrThrow();

  return { observationId: observation.id, evidenceFileId: evidence.id, sha256, duplicateOf };
}

export async function getObservationById(id: string) {
  const observation = await db
    .selectFrom('field_observations')
    .innerJoin('ecosystem_types', 'ecosystem_types.id', 'field_observations.ecosystem_type_id')
    .innerJoin('users', 'users.id', 'field_observations.contributor_id')
    .select([
      'field_observations.id as id',
      'field_observations.captured_at as captured_at',
      'field_observations.notes as notes',
      'field_observations.reported_area_m2 as reported_area_m2',
      'field_observations.created_at as created_at',
      'ecosystem_types.code as ecosystem_code',
      'ecosystem_types.name as ecosystem_name',
      'users.id as contributor_id',
      'users.full_name as contributor_name',
      geographySelect.latitude.as('latitude'),
      geographySelect.longitude.as('longitude'),
    ])
    .where('field_observations.id', '=', id)
    .executeTakeFirst();

  if (!observation) {
    throw new NotFoundError('Observation', id);
  }

  const evidence = await db
    .selectFrom('evidence_files')
    .select(['id', 'storage_key', 'original_filename', 'mime_type', 'file_size_bytes', 'sha256_hash', 'uploaded_at'])
    .where('observation_id', '=', id)
    .execute();

  const mrvRecord = await db
    .selectFrom('mrv_records')
    .select(['id', 'mrv_code', 'status'])
    .where('observation_id', '=', id)
    .executeTakeFirst();

  return { ...observation, evidence, mrvRecord: mrvRecord ?? null };
}

export interface ListObservationsFilters {
  page: number;
  pageSize: number;
  ecosystemCode?: EcosystemCode;
  contributorId?: string;
  bounds?: { minLat: number; minLng: number; maxLat: number; maxLng: number };
}

export async function listObservations(filters: ListObservationsFilters) {
  let query = db
    .selectFrom('field_observations')
    .innerJoin('ecosystem_types', 'ecosystem_types.id', 'field_observations.ecosystem_type_id')
    .select([
      'field_observations.id as id',
      'field_observations.captured_at as captured_at',
      'field_observations.reported_area_m2 as reported_area_m2',
      'field_observations.created_at as created_at',
      'ecosystem_types.code as ecosystem_code',
      'field_observations.contributor_id as contributor_id',
      geographySelect.latitude.as('latitude'),
      geographySelect.longitude.as('longitude'),
    ]);

  if (filters.ecosystemCode) {
    query = query.where('ecosystem_types.code', '=', filters.ecosystemCode);
  }
  if (filters.contributorId) {
    query = query.where('field_observations.contributor_id', '=', filters.contributorId);
  }
  if (filters.bounds) {
    query = query.where(withinBoundingBox('field_observations.location', filters.bounds));
  }

  const rows = await query
    .orderBy('field_observations.created_at', 'desc')
    .limit(filters.pageSize)
    .offset((filters.page - 1) * filters.pageSize)
    .execute();

  return rows;
}
