import { createHash } from 'node:crypto';
import { env } from '../config/env';
import { db } from '../db/client';
import { geographySelect } from '../db/geo';
import type { EcosystemCode, MrvStatus } from '../db/types';
import { recordAuditEvent } from './auditService';
import { recordBlockchainTransaction } from './blockchainTransactionService';
import { calculateCarbonEstimate } from './carbonCalculationService';
import { detectDuplicates } from './duplicateDetectionService';
import { fabric } from './fabricService';
import { analyzeImage } from './mlClient';
import { createNotification } from './notificationService';
import { getObservationById } from './observationService';
import { readObjectAsBuffer } from './storageService';
import { AppError, ConflictError, NotFoundError } from '../utils/errors';

/** Canonical hash of the facts that must not silently change between off-chain and on-chain -
 * lets a caller (or an auditor) detect drift between the Postgres row and the ledger record. */
function computeMetadataHash(fields: Record<string, unknown>): string {
  const canonical = JSON.stringify(fields, Object.keys(fields).sort());
  return createHash('sha256').update(canonical).digest('hex');
}

async function getMrvRecordOrThrow(id: string) {
  const row = await db.selectFrom('mrv_records').selectAll().where('id', '=', id).executeTakeFirst();
  if (!row) throw new NotFoundError('MRV record', id);
  return row;
}

function assertStatus(record: { status: MrvStatus; mrv_code: string | null }, expected: MrvStatus): void {
  if (record.status !== expected) {
    throw new ConflictError(
      `MRV record ${record.mrv_code ?? ''} is '${record.status}'; this action requires '${expected}'`
    );
  }
}

export async function getMrvOwnerContributorId(mrvId: string): Promise<string> {
  const row = await db
    .selectFrom('mrv_records')
    .innerJoin('field_observations', 'field_observations.id', 'mrv_records.observation_id')
    .select('field_observations.contributor_id as contributor_id')
    .where('mrv_records.id', '=', mrvId)
    .executeTakeFirst();
  if (!row) throw new NotFoundError('MRV record', mrvId);
  return row.contributor_id;
}

export async function createDraftMrvRecord(observationId: string, actorId: string) {
  const existing = await db
    .selectFrom('mrv_records')
    .select('id')
    .where('observation_id', '=', observationId)
    .executeTakeFirst();
  if (existing) {
    throw new ConflictError('This observation already has an MRV record');
  }

  const observation = await db
    .selectFrom('field_observations')
    .select('id')
    .where('id', '=', observationId)
    .executeTakeFirst();
  if (!observation) {
    throw new NotFoundError('Observation', observationId);
  }

  const row = await db
    .insertInto('mrv_records')
    .values({ observation_id: observationId, status: 'draft' })
    .returning(['id', 'mrv_code'])
    .executeTakeFirstOrThrow();

  await recordAuditEvent({ actorId, action: 'mrv.create_draft', entityType: 'mrv_records', entityId: row.id });
  return row;
}

export async function submitMrvRecord(mrvId: string, actorId: string): Promise<void> {
  const record = await getMrvRecordOrThrow(mrvId);
  assertStatus(record, 'draft');

  await db.updateTable('mrv_records').set({ status: 'submitted' }).where('id', '=', mrvId).execute();
  await recordAuditEvent({ actorId, action: 'mrv.submit', entityType: 'mrv_records', entityId: mrvId });
}

export async function runAiAnalysisForMrv(mrvId: string, actorId: string) {
  const record = await getMrvRecordOrThrow(mrvId);
  assertStatus(record, 'submitted');

  const evidence = await db
    .selectFrom('evidence_files')
    .selectAll()
    .where('observation_id', '=', record.observation_id)
    .orderBy('uploaded_at', 'asc')
    .executeTakeFirst();
  if (!evidence) {
    throw new AppError(500, 'MISSING_EVIDENCE', 'Observation has no evidence file to analyze');
  }

  const buffer = await readObjectAsBuffer(evidence.storage_key);
  const result = await analyzeImage(buffer, evidence.mime_type, evidence.original_filename ?? 'evidence.jpg');

  const predictedEcosystemType = await db
    .selectFrom('ecosystem_types')
    .select('id')
    .where('code', '=', result.predictedEcosystem)
    .executeTakeFirstOrThrow();

  const analysisRow = await db
    .insertInto('ai_analysis')
    .values({
      observation_id: record.observation_id,
      evidence_file_id: evidence.id,
      model_name: result.modelName,
      model_mode: result.modelMode,
      predicted_ecosystem_type_id: predictedEcosystemType.id,
      confidence: result.confidence.toString(),
      vegetation_coverage_pct: result.vegetationCoveragePct.toString(),
      raw_output: result.explanation,
      warnings: result.warnings,
      inference_ms: result.inferenceMs,
    })
    .returning('id')
    .executeTakeFirstOrThrow();

  await db
    .updateTable('mrv_records')
    .set({ status: 'ai_analyzed', ai_analysis_id: analysisRow.id })
    .where('id', '=', mrvId)
    .execute();

  await recordAuditEvent({
    actorId,
    action: 'mrv.ai_analyze',
    entityType: 'mrv_records',
    entityId: mrvId,
    metadata: { predictedEcosystem: result.predictedEcosystem, confidence: result.confidence },
  });

  return { analysisId: analysisRow.id, result };
}

export async function calculateMrvRecord(mrvId: string, actorId: string) {
  const record = await getMrvRecordOrThrow(mrvId);
  assertStatus(record, 'ai_analyzed');

  const observation = await db
    .selectFrom('field_observations')
    .selectAll()
    .where('id', '=', record.observation_id)
    .executeTakeFirstOrThrow();
  const analysis = await db
    .selectFrom('ai_analysis')
    .selectAll()
    .where('id', '=', record.ai_analysis_id as string)
    .executeTakeFirstOrThrow();

  const { breakdown, carbonFactorId } = await calculateCarbonEstimate(observation.ecosystem_type_id, {
    vegetationCoveragePct: Number(analysis.vegetation_coverage_pct),
    reportedAreaM2: Number(observation.reported_area_m2),
  });

  const duplicates = await detectDuplicates(record.observation_id);
  const topDuplicate = duplicates[0] ?? null;

  // Chain call happens before the Postgres write commits the transition, so a Fabric failure
  // blocks the off-chain state change too rather than letting the two drift out of sync -
  // see docs/BLOCKCHAIN.md.
  if (env.FABRIC_ENABLED) {
    const evidence = await db
      .selectFrom('evidence_files')
      .select(['sha256_hash'])
      .where('observation_id', '=', record.observation_id)
      .orderBy('uploaded_at', 'asc')
      .executeTakeFirstOrThrow();

    const location = await db
      .selectFrom('field_observations')
      .select([geographySelect.latitude.as('latitude'), geographySelect.longitude.as('longitude')])
      .where('id', '=', record.observation_id)
      .executeTakeFirstOrThrow();

    const metadataHash = computeMetadataHash({
      mrvId,
      ecosystemCode: breakdown.ecosystem_code,
      areaM2: breakdown.effective_area_m2,
      estimatedCarbonTco2e: breakdown.estimated_carbon_tco2e,
      capturedAt: observation.captured_at.toISOString(),
    });

    const chainResult = await fabric.createMrvRecord({
      mrvId,
      mrvCode: record.mrv_code ?? mrvId,
      contributorOrg: env.FABRIC_MSP_ID,
      ecosystemType: breakdown.ecosystem_code,
      latitude: location.latitude,
      longitude: location.longitude,
      capturedAt: observation.captured_at.toISOString(),
      areaM2: breakdown.effective_area_m2,
      estimatedCarbonTco2e: breakdown.estimated_carbon_tco2e,
      aiConfidence: Number(analysis.confidence),
      evidenceHash: evidence.sha256_hash,
      metadataHash,
    });
    await recordBlockchainTransaction({
      mrvRecordId: mrvId,
      chaincodeFunction: 'CreateMRVRecord',
      fabricTxId: chainResult.txId,
      submittedBy: actorId,
    });
  }

  await db
    .updateTable('mrv_records')
    .set({
      status: 'pending_validation',
      carbon_factor_id: carbonFactorId,
      estimated_area_m2: breakdown.effective_area_m2.toString(),
      vegetation_coverage_pct: breakdown.vegetation_coverage_pct.toString(),
      estimated_carbon_tco2e: breakdown.estimated_carbon_tco2e.toString(),
      calculation_breakdown: breakdown,
      duplicate_of_mrv_id: topDuplicate?.matchedMrvId ?? null,
      duplicate_reason: topDuplicate?.detail ?? null,
    })
    .where('id', '=', mrvId)
    .execute();

  await recordAuditEvent({
    actorId,
    action: 'mrv.calculate',
    entityType: 'mrv_records',
    entityId: mrvId,
    metadata: { estimatedCarbonTco2e: breakdown.estimated_carbon_tco2e, duplicateSignalCount: duplicates.length },
  });

  const validators = await db
    .selectFrom('users')
    .select('id')
    .where('role', '=', 'validator')
    .where('is_active', '=', true)
    .execute();
  for (const validator of validators) {
    await createNotification({
      userId: validator.id,
      type: duplicates.length > 0 ? 'duplicate_suspected' : 'validation_required',
      title: duplicates.length > 0 ? 'MRV record flagged as a possible duplicate' : 'MRV record ready for validation',
      message: `${record.mrv_code ?? mrvId}${duplicates.length > 0 ? `: ${topDuplicate!.detail}` : ' is ready for review.'}`,
      relatedEntityType: 'mrv_records',
      relatedEntityId: mrvId,
    });
  }

  return { breakdown, duplicates };
}

export async function approveMrvRecord(mrvId: string, validatorId: string, reason?: string): Promise<void> {
  const record = await getMrvRecordOrThrow(mrvId);
  assertStatus(record, 'pending_validation');

  if (env.FABRIC_ENABLED) {
    const chainResult = await fabric.validateMrvRecord(mrvId, validatorId, reason ?? '');
    await recordBlockchainTransaction({
      mrvRecordId: mrvId,
      chaincodeFunction: 'ValidateMRVRecord',
      fabricTxId: chainResult.txId,
      submittedBy: validatorId,
    });
  }

  await db.updateTable('mrv_records').set({ status: 'verified' }).where('id', '=', mrvId).execute();
  await db
    .insertInto('validation_events')
    .values({ mrv_record_id: mrvId, validator_id: validatorId, action: 'approve', reason: reason ?? null })
    .execute();
  await recordAuditEvent({ actorId: validatorId, action: 'mrv.approve', entityType: 'mrv_records', entityId: mrvId });

  const contributorId = await getMrvOwnerContributorId(mrvId);
  await createNotification({
    userId: contributorId,
    type: 'mrv_verified',
    title: 'MRV record verified',
    message: `${record.mrv_code ?? mrvId} has been verified by a validator.`,
    relatedEntityType: 'mrv_records',
    relatedEntityId: mrvId,
  });
}

export async function rejectMrvRecord(mrvId: string, validatorId: string, reason: string): Promise<void> {
  const record = await getMrvRecordOrThrow(mrvId);
  assertStatus(record, 'pending_validation');

  if (env.FABRIC_ENABLED) {
    const chainResult = await fabric.rejectMrvRecord(mrvId, validatorId, reason);
    await recordBlockchainTransaction({
      mrvRecordId: mrvId,
      chaincodeFunction: 'RejectMRVRecord',
      fabricTxId: chainResult.txId,
      submittedBy: validatorId,
    });
  }

  await db
    .updateTable('mrv_records')
    .set({ status: 'rejected', rejection_reason: reason })
    .where('id', '=', mrvId)
    .execute();
  await db
    .insertInto('validation_events')
    .values({ mrv_record_id: mrvId, validator_id: validatorId, action: 'reject', reason })
    .execute();
  await recordAuditEvent({
    actorId: validatorId,
    action: 'mrv.reject',
    entityType: 'mrv_records',
    entityId: mrvId,
    metadata: { reason },
  });

  const contributorId = await getMrvOwnerContributorId(mrvId);
  await createNotification({
    userId: contributorId,
    type: 'mrv_rejected',
    title: 'MRV record rejected',
    message: `${record.mrv_code ?? mrvId} was rejected: ${reason}`,
    relatedEntityType: 'mrv_records',
    relatedEntityId: mrvId,
  });
}

/** VERIFIED -> TOKENIZED. Only reachable once a validator has approved the record - the
 * chaincode enforces the same rule independently (see mrvContract.js's transition guard), so
 * this can't be bypassed even by a bug here. Asset id mirrors the human-readable MRV code
 * (MRV-000241 -> BC-000241) rather than a new counter, so the two are visibly correlated. */
export async function tokenizeMrvRecord(mrvId: string, actorId: string) {
  const record = await getMrvRecordOrThrow(mrvId);
  assertStatus(record, 'verified');

  if (!env.FABRIC_ENABLED) {
    throw new AppError(
      503,
      'BLOCKCHAIN_DISABLED',
      'Tokenization requires the Fabric network (FABRIC_ENABLED=false)'
    );
  }

  const observation = await db
    .selectFrom('field_observations')
    .selectAll()
    .where('id', '=', record.observation_id)
    .executeTakeFirstOrThrow();
  const evidence = await db
    .selectFrom('evidence_files')
    .select(['sha256_hash'])
    .where('observation_id', '=', record.observation_id)
    .orderBy('uploaded_at', 'asc')
    .executeTakeFirstOrThrow();
  const ecosystemType = await db
    .selectFrom('ecosystem_types')
    .select('code')
    .where('id', '=', observation.ecosystem_type_id)
    .executeTakeFirstOrThrow();

  const metadataHash = computeMetadataHash({
    mrvId,
    ecosystemCode: ecosystemType.code,
    areaM2: Number(record.estimated_area_m2),
    estimatedCarbonTco2e: Number(record.estimated_carbon_tco2e),
    capturedAt: observation.captured_at.toISOString(),
  });

  const assetId = (record.mrv_code ?? mrvId).replace('MRV-', 'BC-');

  const chainResult = await fabric.issueCarbonToken(mrvId, assetId, env.FABRIC_MSP_ID);
  await recordBlockchainTransaction({
    mrvRecordId: mrvId,
    chaincodeFunction: 'IssueCarbonToken',
    fabricTxId: chainResult.txId,
    submittedBy: actorId,
  });

  await db
    .insertInto('blockchain_assets')
    .values({
      mrv_record_id: mrvId,
      asset_id: assetId,
      fabric_tx_id: chainResult.txId,
      channel_name: env.FABRIC_CHANNEL_NAME,
      chaincode_name: env.FABRIC_CHAINCODE_NAME,
      evidence_hash: evidence.sha256_hash,
      metadata_hash: metadataHash,
      ledger_status: 'committed',
      committed_at: new Date(),
    })
    .execute();

  await db.updateTable('mrv_records').set({ status: 'tokenized' }).where('id', '=', mrvId).execute();

  await recordAuditEvent({
    actorId,
    action: 'mrv.tokenize',
    entityType: 'mrv_records',
    entityId: mrvId,
    metadata: { assetId },
  });

  const contributorId = await getMrvOwnerContributorId(mrvId);
  await createNotification({
    userId: contributorId,
    type: 'token_issued',
    title: 'Carbon asset issued',
    message: `${assetId} has been issued for ${record.mrv_code ?? mrvId}.`,
    relatedEntityType: 'mrv_records',
    relatedEntityId: mrvId,
  });

  return { assetId, txId: chainResult.txId };
}

export async function getMrvRecordDetail(mrvId: string) {
  const record = await getMrvRecordOrThrow(mrvId);
  const observation = await getObservationById(record.observation_id);

  const validationEvents = await db
    .selectFrom('validation_events')
    .innerJoin('users', 'users.id', 'validation_events.validator_id')
    .select([
      'validation_events.id as id',
      'validation_events.action as action',
      'validation_events.reason as reason',
      'validation_events.created_at as created_at',
      'users.full_name as validator_name',
    ])
    .where('mrv_record_id', '=', mrvId)
    .orderBy('validation_events.created_at', 'asc')
    .execute();

  const blockchainAsset = await db
    .selectFrom('blockchain_assets')
    .selectAll()
    .where('mrv_record_id', '=', mrvId)
    .executeTakeFirst();

  const blockchainTransactions = await db
    .selectFrom('blockchain_transactions')
    .selectAll()
    .where('mrv_record_id', '=', mrvId)
    .orderBy('created_at', 'asc')
    .execute();

  const aiAnalysis = record.ai_analysis_id
    ? await db.selectFrom('ai_analysis').selectAll().where('id', '=', record.ai_analysis_id).executeTakeFirst()
    : null;

  return {
    ...record,
    observation,
    aiAnalysis: aiAnalysis ?? null,
    validationEvents,
    blockchainAsset: blockchainAsset ?? null,
    blockchainTransactions,
  };
}

export interface ListMrvFilters {
  page: number;
  pageSize: number;
  status?: MrvStatus;
  contributorId?: string;
  ecosystemCode?: EcosystemCode;
}

export async function listMrvRecords(filters: ListMrvFilters) {
  let query = db
    .selectFrom('mrv_records')
    .innerJoin('field_observations', 'field_observations.id', 'mrv_records.observation_id')
    .innerJoin('ecosystem_types', 'ecosystem_types.id', 'field_observations.ecosystem_type_id')
    .select([
      'mrv_records.id as id',
      'mrv_records.mrv_code as mrv_code',
      'mrv_records.status as status',
      'mrv_records.estimated_carbon_tco2e as estimated_carbon_tco2e',
      'mrv_records.duplicate_of_mrv_id as duplicate_of_mrv_id',
      'mrv_records.created_at as created_at',
      'ecosystem_types.code as ecosystem_code',
      'field_observations.contributor_id as contributor_id',
    ]);

  if (filters.status) {
    query = query.where('mrv_records.status', '=', filters.status);
  }
  if (filters.contributorId) {
    query = query.where('field_observations.contributor_id', '=', filters.contributorId);
  }
  if (filters.ecosystemCode) {
    query = query.where('ecosystem_types.code', '=', filters.ecosystemCode);
  }

  return query
    .orderBy('mrv_records.created_at', 'desc')
    .limit(filters.pageSize)
    .offset((filters.page - 1) * filters.pageSize)
    .execute();
}
