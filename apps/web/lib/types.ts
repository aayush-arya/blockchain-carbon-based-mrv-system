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
export type AiModelMode = 'heuristic' | 'pretrained';
export type LedgerStatus = 'pending' | 'committed' | 'failed';

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  organizationId: string | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

export interface EcosystemType {
  id: string;
  code: EcosystemCode;
  name: string;
  description: string | null;
}

export interface CarbonFactor {
  id: string;
  ecosystem_code: EcosystemCode;
  ecosystem_name: string;
  factor_value: string;
  unit: string;
  source: string;
  effective_date: string;
  notes: string | null;
  is_active: boolean;
}

export interface EvidenceFile {
  id: string;
  storage_key: string;
  original_filename: string | null;
  mime_type: string;
  file_size_bytes: string;
  sha256_hash: string;
  uploaded_at: string;
}

export interface ObservationSummary {
  id: string;
  captured_at: string;
  reported_area_m2: string;
  created_at: string;
  ecosystem_code: EcosystemCode;
  contributor_id: string;
  latitude: number;
  longitude: number;
}

export interface ObservationDetail extends ObservationSummary {
  notes: string | null;
  ecosystem_name: string;
  contributor_name: string;
  evidence: EvidenceFile[];
  mrvRecord: { id: string; mrv_code: string; status: MrvStatus } | null;
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

export interface AiAnalysis {
  id: string;
  observation_id: string;
  evidence_file_id: string;
  model_name: string;
  model_mode: AiModelMode;
  predicted_ecosystem_type_id: string | null;
  confidence: string;
  vegetation_coverage_pct: string;
  raw_output: {
    ecosystem_scores?: Record<string, number>;
    features?: Record<string, number>;
    coverage_method?: string;
    coverage_threshold_used?: number;
    coverage_mean_index?: number;
  };
  warnings: string[];
  inference_ms: number | null;
  created_at: string;
}

export interface ValidationEvent {
  id: string;
  action: 'approve' | 'reject' | 'flag_duplicate' | 'comment';
  reason: string | null;
  created_at: string;
  validator_name: string;
}

export interface BlockchainAsset {
  id: string;
  mrv_record_id: string;
  asset_id: string;
  fabric_tx_id: string;
  channel_name: string;
  chaincode_name: string;
  evidence_hash: string;
  metadata_hash: string;
  block_number: string | null;
  ledger_status: LedgerStatus;
  committed_at: string | null;
  created_at: string;
}

export interface BlockchainTransactionRef {
  id: string;
  mrv_record_id: string;
  chaincode_function: string;
  fabric_tx_id: string;
  channel_name: string;
  chaincode_name: string;
  submitted_by: string | null;
  created_at: string;
}

export interface MrvRecordSummary {
  id: string;
  mrv_code: string;
  status: MrvStatus;
  estimated_carbon_tco2e: string | null;
  duplicate_of_mrv_id: string | null;
  created_at: string;
  ecosystem_code: EcosystemCode;
  contributor_id: string;
}

export interface MrvRecordDetail {
  id: string;
  mrv_code: string;
  status: MrvStatus;
  estimated_area_m2: string | null;
  vegetation_coverage_pct: string | null;
  estimated_carbon_tco2e: string | null;
  calculation_breakdown: CarbonCalculationBreakdown | null;
  duplicate_of_mrv_id: string | null;
  duplicate_reason: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
  observation: ObservationDetail;
  aiAnalysis: AiAnalysis | null;
  validationEvents: ValidationEvent[];
  blockchainAsset: BlockchainAsset | null;
  blockchainTransactions: BlockchainTransactionRef[];
}

export interface DuplicateSignal {
  type: 'exact_evidence_hash' | 'geo_time_proximity';
  matchedMrvId: string;
  matchedMrvCode: string;
  matchedObservationId: string;
  detail: string;
}

export interface HealthComponent {
  status: 'ok' | 'error' | 'disabled';
  detail?: string;
}

export interface SystemHealth {
  status: 'ok' | 'degraded';
  timestamp: string;
  components: Record<'api' | 'database' | 'object_storage' | 'ai_service' | 'blockchain', HealthComponent>;
}
