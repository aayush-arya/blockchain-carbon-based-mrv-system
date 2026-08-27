import { db } from '../db/client';
import { NotFoundError } from '../utils/errors';

export async function getBlockchainStats() {
  const [txCount, assetCount] = await Promise.all([
    db.selectFrom('blockchain_transactions').select(db.fn.countAll().as('count')).executeTakeFirstOrThrow(),
    db.selectFrom('blockchain_assets').select(db.fn.countAll().as('count')).executeTakeFirstOrThrow(),
  ]);
  return {
    transactionCount: Number(txCount.count),
    tokenizedAssetCount: Number(assetCount.count),
  };
}

export interface ListTransactionsFilters {
  page: number;
  pageSize: number;
}

export async function listRecentTransactions(filters: ListTransactionsFilters) {
  return db
    .selectFrom('blockchain_transactions')
    .innerJoin('mrv_records', 'mrv_records.id', 'blockchain_transactions.mrv_record_id')
    .select([
      'blockchain_transactions.id as id',
      'blockchain_transactions.fabric_tx_id as fabric_tx_id',
      'blockchain_transactions.chaincode_function as chaincode_function',
      'blockchain_transactions.channel_name as channel_name',
      'blockchain_transactions.created_at as created_at',
      'mrv_records.id as mrv_record_id',
      'mrv_records.mrv_code as mrv_code',
      'mrv_records.status as mrv_status',
    ])
    .orderBy('blockchain_transactions.created_at', 'desc')
    .limit(filters.pageSize)
    .offset((filters.page - 1) * filters.pageSize)
    .execute();
}

export async function getTransactionDetail(fabricTxId: string) {
  const row = await db
    .selectFrom('blockchain_transactions')
    .innerJoin('mrv_records', 'mrv_records.id', 'blockchain_transactions.mrv_record_id')
    .innerJoin('field_observations', 'field_observations.id', 'mrv_records.observation_id')
    .innerJoin('ecosystem_types', 'ecosystem_types.id', 'field_observations.ecosystem_type_id')
    .leftJoin('users', 'users.id', 'blockchain_transactions.submitted_by')
    .select([
      'blockchain_transactions.id as id',
      'blockchain_transactions.fabric_tx_id as fabric_tx_id',
      'blockchain_transactions.chaincode_function as chaincode_function',
      'blockchain_transactions.channel_name as channel_name',
      'blockchain_transactions.chaincode_name as chaincode_name',
      'blockchain_transactions.created_at as created_at',
      'mrv_records.id as mrv_record_id',
      'mrv_records.mrv_code as mrv_code',
      'mrv_records.status as mrv_status',
      'mrv_records.estimated_carbon_tco2e as estimated_carbon_tco2e',
      'ecosystem_types.code as ecosystem_code',
      'users.full_name as submitted_by_name',
    ])
    .where('blockchain_transactions.fabric_tx_id', '=', fabricTxId)
    .executeTakeFirst();

  if (!row) throw new NotFoundError('Blockchain transaction', fabricTxId);
  return row;
}

export async function getAssetDetail(assetId: string) {
  const asset = await db
    .selectFrom('blockchain_assets')
    .innerJoin('mrv_records', 'mrv_records.id', 'blockchain_assets.mrv_record_id')
    .innerJoin('field_observations', 'field_observations.id', 'mrv_records.observation_id')
    .innerJoin('ecosystem_types', 'ecosystem_types.id', 'field_observations.ecosystem_type_id')
    .innerJoin('users', 'users.id', 'field_observations.contributor_id')
    .select([
      'blockchain_assets.asset_id as asset_id',
      'blockchain_assets.fabric_tx_id as fabric_tx_id',
      'blockchain_assets.evidence_hash as evidence_hash',
      'blockchain_assets.metadata_hash as metadata_hash',
      'blockchain_assets.ledger_status as ledger_status',
      'blockchain_assets.committed_at as committed_at',
      'mrv_records.id as mrv_record_id',
      'mrv_records.mrv_code as mrv_code',
      'mrv_records.status as mrv_status',
      'mrv_records.estimated_carbon_tco2e as estimated_carbon_tco2e',
      'ecosystem_types.code as ecosystem_code',
      'ecosystem_types.name as ecosystem_name',
      'users.full_name as contributor_name',
    ])
    .where('blockchain_assets.asset_id', '=', assetId)
    .executeTakeFirst();

  if (!asset) throw new NotFoundError('Carbon asset', assetId);
  return asset;
}
