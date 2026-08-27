import type { ColumnType, Generated } from 'kysely';

export type UserRole = 'field_operator' | 'validator' | 'admin';
export type EcosystemCode = 'mangrove' | 'seagrass' | 'salt_marsh';
export type MrvStatus =
  | 'draft'
  | 'submitted'
  | 'ai_analyzed'
  | 'pending_validation'
  | 'verified'
  | 'tokenized'
  | 'rejected';
export type ValidationAction = 'approve' | 'reject' | 'flag_duplicate' | 'comment';
export type LedgerStatus = 'pending' | 'committed' | 'failed';
export type AiModelMode = 'heuristic' | 'pretrained';
export type NotificationType =
  | 'observation_received'
  | 'ai_analysis_completed'
  | 'validation_required'
  | 'mrv_verified'
  | 'mrv_rejected'
  | 'blockchain_confirmed'
  | 'token_issued'
  | 'duplicate_suspected';

/** Timestamps that Postgres fills in via DEFAULT now(); never set on insert. */
type CreatedAt = ColumnType<Date, never, never>;
type UpdatedAt = ColumnType<Date, never, never>;

export interface OrganizationsTable {
  id: Generated<string>;
  name: string;
  type: string;
  description: string | null;
  created_at: CreatedAt;
  updated_at: UpdatedAt;
}

export interface UsersTable {
  id: Generated<string>;
  organization_id: string | null;
  email: string;
  password_hash: string;
  full_name: string;
  role: UserRole;
  is_active: Generated<boolean>;
  last_login_at: Date | null;
  created_at: CreatedAt;
  updated_at: UpdatedAt;
}

export interface EcosystemTypesTable {
  id: Generated<string>;
  code: EcosystemCode;
  name: string;
  description: string | null;
  created_at: CreatedAt;
}

export interface CarbonFactorsTable {
  id: Generated<string>;
  ecosystem_type_id: string;
  factor_value: string; // NUMERIC comes back as string from pg by default
  unit: string;
  source: string;
  effective_date: string;
  notes: string | null;
  is_active: Generated<boolean>;
  created_at: CreatedAt;
}

/**
 * `location` is a PostGIS GEOGRAPHY(Point,4326). Kysely has no native geography type, so raw
 * SQL builds/reads it (see src/db/geo.ts) — do not select/insert it as a plain string.
 */
export interface FieldObservationsTable {
  id: Generated<string>;
  contributor_id: string;
  organization_id: string | null;
  ecosystem_type_id: string;
  location: ColumnType<unknown, unknown, unknown>;
  captured_at: Date;
  notes: string | null;
  reported_area_m2: string | null;
  created_at: CreatedAt;
  updated_at: UpdatedAt;
}

export interface EvidenceFilesTable {
  id: Generated<string>;
  observation_id: string;
  storage_key: string;
  original_filename: string | null;
  mime_type: string;
  file_size_bytes: string;
  sha256_hash: string;
  uploaded_at: CreatedAt;
}

export interface AiAnalysisRawOutput {
  [key: string]: unknown;
}

export interface AiAnalysisTable {
  id: Generated<string>;
  observation_id: string;
  evidence_file_id: string;
  model_name: string;
  model_mode: AiModelMode;
  predicted_ecosystem_type_id: string | null;
  confidence: string;
  vegetation_coverage_pct: string;
  raw_output: ColumnType<AiAnalysisRawOutput, AiAnalysisRawOutput, AiAnalysisRawOutput>;
  warnings: string[];
  inference_ms: number | null;
  created_at: CreatedAt;
}

export interface CarbonCalculationBreakdown {
  ecosystem_code: EcosystemCode;
  vegetation_coverage_pct: number;
  reported_area_m2: number;
  effective_area_m2: number;
  carbon_factor_value: number;
  carbon_factor_unit: string;
  carbon_factor_source: string;
  formula: string;
  estimated_carbon_tco2e: number;
  calculated_at: string;
}

export interface MrvRecordsTable {
  id: Generated<string>;
  mrv_code: Generated<string>;
  observation_id: string;
  ai_analysis_id: string | null;
  status: Generated<MrvStatus>;
  carbon_factor_id: string | null;
  estimated_area_m2: string | null;
  vegetation_coverage_pct: string | null;
  estimated_carbon_tco2e: string | null;
  calculation_breakdown: ColumnType<
    CarbonCalculationBreakdown | null,
    CarbonCalculationBreakdown | null,
    CarbonCalculationBreakdown | null
  >;
  duplicate_of_mrv_id: string | null;
  duplicate_reason: string | null;
  rejection_reason: string | null;
  created_at: CreatedAt;
  updated_at: UpdatedAt;
}

export interface ValidationEventsTable {
  id: Generated<string>;
  mrv_record_id: string;
  validator_id: string;
  action: ValidationAction;
  reason: string | null;
  metadata: Generated<Record<string, unknown>>;
  created_at: CreatedAt;
}

export interface BlockchainAssetsTable {
  id: Generated<string>;
  mrv_record_id: string;
  asset_id: string;
  fabric_tx_id: string;
  channel_name: string;
  chaincode_name: string;
  evidence_hash: string;
  metadata_hash: string;
  block_number: string | null;
  ledger_status: Generated<LedgerStatus>;
  committed_at: Date | null;
  created_at: CreatedAt;
}

export interface AuditLogsTable {
  id: Generated<string>;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Generated<Record<string, unknown>>;
  ip_address: string | null;
  created_at: CreatedAt;
}

export interface NotificationsTable {
  id: Generated<string>;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  related_entity_type: string | null;
  related_entity_id: string | null;
  read_at: Date | null;
  created_at: CreatedAt;
}

export type ChaincodeFunction = 'CreateMRVRecord' | 'ValidateMRVRecord' | 'RejectMRVRecord' | 'IssueCarbonToken';

export interface BlockchainTransactionsTable {
  id: Generated<string>;
  mrv_record_id: string;
  chaincode_function: ChaincodeFunction;
  fabric_tx_id: string;
  channel_name: string;
  chaincode_name: string;
  submitted_by: string | null;
  created_at: CreatedAt;
}

export interface RefreshTokensTable {
  id: Generated<string>;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  revoked_at: Date | null;
  created_at: CreatedAt;
}

export interface Database {
  organizations: OrganizationsTable;
  users: UsersTable;
  ecosystem_types: EcosystemTypesTable;
  carbon_factors: CarbonFactorsTable;
  field_observations: FieldObservationsTable;
  evidence_files: EvidenceFilesTable;
  ai_analysis: AiAnalysisTable;
  mrv_records: MrvRecordsTable;
  validation_events: ValidationEventsTable;
  blockchain_assets: BlockchainAssetsTable;
  audit_logs: AuditLogsTable;
  notifications: NotificationsTable;
  refresh_tokens: RefreshTokensTable;
  blockchain_transactions: BlockchainTransactionsTable;
}
