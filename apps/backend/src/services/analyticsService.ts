import { sql } from 'kysely';
import { db } from '../db/client';

export async function getDashboardAnalytics() {
  const [
    totalObservations,
    statusCounts,
    ecosystemDistribution,
    carbonTotal,
    confidenceBuckets,
    recentMrvRecords,
    recentTransactions,
  ] = await Promise.all([
    db.selectFrom('field_observations').select(db.fn.countAll().as('count')).executeTakeFirstOrThrow(),

    db
      .selectFrom('mrv_records')
      .select(['status', db.fn.countAll().as('count')])
      .groupBy('status')
      .execute(),

    db
      .selectFrom('field_observations')
      .innerJoin('ecosystem_types', 'ecosystem_types.id', 'field_observations.ecosystem_type_id')
      .select(['ecosystem_types.code as ecosystem_code', db.fn.countAll().as('count')])
      .groupBy('ecosystem_types.code')
      .execute(),

    db
      .selectFrom('mrv_records')
      .select(sql<string>`COALESCE(SUM(estimated_carbon_tco2e), 0)`.as('total'))
      .where('status', 'in', ['verified', 'tokenized'])
      .executeTakeFirstOrThrow(),

    db
      .selectFrom('ai_analysis')
      .select([sql<number>`FLOOR(confidence * 10) / 10`.as('bucket'), db.fn.countAll().as('count')])
      .groupBy(sql`FLOOR(confidence * 10) / 10`)
      .orderBy(sql`FLOOR(confidence * 10) / 10`)
      .execute(),

    db
      .selectFrom('mrv_records')
      .innerJoin('field_observations', 'field_observations.id', 'mrv_records.observation_id')
      .innerJoin('ecosystem_types', 'ecosystem_types.id', 'field_observations.ecosystem_type_id')
      .select([
        'mrv_records.id as id',
        'mrv_records.mrv_code as mrv_code',
        'mrv_records.status as status',
        'mrv_records.estimated_carbon_tco2e as estimated_carbon_tco2e',
        'mrv_records.created_at as created_at',
        'ecosystem_types.code as ecosystem_code',
      ])
      .orderBy('mrv_records.created_at', 'desc')
      .limit(8)
      .execute(),

    db
      .selectFrom('blockchain_transactions')
      .innerJoin('mrv_records', 'mrv_records.id', 'blockchain_transactions.mrv_record_id')
      .select([
        'blockchain_transactions.id as id',
        'blockchain_transactions.fabric_tx_id as fabric_tx_id',
        'blockchain_transactions.chaincode_function as chaincode_function',
        'blockchain_transactions.created_at as created_at',
        'mrv_records.mrv_code as mrv_code',
      ])
      .orderBy('blockchain_transactions.created_at', 'desc')
      .limit(8)
      .execute(),
  ]);

  const statusMap = new Map(statusCounts.map((row) => [row.status, Number(row.count)]));
  const verified = statusMap.get('verified') ?? 0;
  const tokenized = statusMap.get('tokenized') ?? 0;
  const rejected = statusMap.get('rejected') ?? 0;
  const pendingValidation = statusMap.get('pending_validation') ?? 0;
  const decided = verified + tokenized + rejected;

  return {
    totalObservations: Number(totalObservations.count),
    verifiedMrvRecords: verified,
    tokenizedRecords: tokenized,
    pendingValidation,
    rejectedRecords: rejected,
    estimatedCarbonTotal: Number(carbonTotal.total),
    validationSuccessRate: decided > 0 ? (verified + tokenized) / decided : null,
    ecosystemDistribution: ecosystemDistribution.map((row) => ({
      ecosystemCode: row.ecosystem_code,
      count: Number(row.count),
    })),
    aiConfidenceDistribution: confidenceBuckets.map((row) => ({
      bucket: Number(row.bucket),
      count: Number(row.count),
    })),
    recentMrvRecords,
    recentBlockchainTransactions: recentTransactions,
  };
}
