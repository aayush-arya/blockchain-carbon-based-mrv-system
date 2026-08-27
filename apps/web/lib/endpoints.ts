import { api } from './api';
import type {
  AiAnalysis,
  BlockchainAsset,
  BlockchainTransactionRef,
  CarbonCalculationBreakdown,
  CarbonFactor,
  DuplicateSignal,
  EcosystemCode,
  EcosystemType,
  MrvRecordDetail,
  MrvRecordSummary,
  MrvStatus,
  ObservationDetail,
  ObservationSummary,
  SystemHealth,
  User,
} from './types';

export const authApi = {
  login: (email: string, password: string) =>
    api.post<{ user: User; tokens: { accessToken: string; refreshToken: string; expiresIn: string } }>(
      '/api/auth/login',
      { email, password },
      { skipAuth: true }
    ),
  register: (email: string, password: string, fullName: string) =>
    api.post<{ user: User; tokens: { accessToken: string; refreshToken: string; expiresIn: string } }>(
      '/api/auth/register',
      { email, password, fullName },
      { skipAuth: true }
    ),
  logout: (refreshToken: string) => api.post<void>('/api/auth/logout', { refreshToken }),
  me: () => api.get<{ user: User }>('/api/auth/me'),
};

export const systemApi = {
  health: () => api.get<SystemHealth>('/api/system/health'),
};

export interface DashboardAnalytics {
  totalObservations: number;
  verifiedMrvRecords: number;
  tokenizedRecords: number;
  pendingValidation: number;
  rejectedRecords: number;
  estimatedCarbonTotal: number;
  validationSuccessRate: number | null;
  ecosystemDistribution: { ecosystemCode: EcosystemCode; count: number }[];
  aiConfidenceDistribution: { bucket: number; count: number }[];
  recentMrvRecords: MrvRecordSummary[];
  recentBlockchainTransactions: (BlockchainTransactionRef & { mrv_code: string })[];
}

export const analyticsApi = {
  dashboard: () => api.get<DashboardAnalytics>('/api/analytics/dashboard'),
};

export const carbonApi = {
  ecosystemTypes: () => api.get<{ ecosystemTypes: EcosystemType[] }>('/api/carbon/ecosystem-types'),
  factors: () => api.get<{ carbonFactors: CarbonFactor[] }>('/api/carbon/factors'),
};

export interface CreateObservationInput {
  ecosystemCode: EcosystemCode;
  latitude: number;
  longitude: number;
  capturedAt: string;
  reportedAreaM2: number;
  notes?: string;
  image: File;
}

export const observationsApi = {
  create: (input: CreateObservationInput) => {
    const formData = new FormData();
    formData.set('ecosystemCode', input.ecosystemCode);
    formData.set('latitude', String(input.latitude));
    formData.set('longitude', String(input.longitude));
    formData.set('capturedAt', input.capturedAt);
    formData.set('reportedAreaM2', String(input.reportedAreaM2));
    if (input.notes) formData.set('notes', input.notes);
    formData.set('image', input.image);
    return api.postForm<{
      observationId: string;
      evidenceFileId: string;
      sha256: string;
      duplicateWarning: { message: string; observationId: string; uploadedAt: string } | null;
    }>('/api/observations', formData);
  },
  list: (params: { page?: number; pageSize?: number; ecosystemCode?: EcosystemCode; contributorId?: string } = {}) =>
    api.get<{ observations: ObservationSummary[]; page: number; pageSize: number }>(
      `/api/observations?${new URLSearchParams(params as Record<string, string>).toString()}`
    ),
  get: (id: string) => api.get<{ observation: ObservationDetail }>(`/api/observations/${id}`),
};

export const evidenceUrl = (evidenceFileId: string) => {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';
  return `${base}/api/evidence/${evidenceFileId}`;
};

export const mrvApi = {
  create: (observationId: string) =>
    api.post<{ mrvRecord: { id: string; mrv_code: string } }>('/api/mrv', { observationId }),
  submit: (id: string) => api.post<{ status: MrvStatus }>(`/api/mrv/${id}/submit`),
  analyze: (id: string) =>
    api.post<{
      status: MrvStatus;
      analysisId: string;
      analysis: {
        modelName: string;
        modelMode: string;
        predictedEcosystem: EcosystemCode;
        confidence: number;
        vegetationCoveragePct: number;
        inferenceMs: number;
        warnings: string[];
        explanation: AiAnalysis['raw_output'];
      };
    }>(`/api/mrv/${id}/analyze`),
  calculate: (id: string) =>
    api.post<{ status: MrvStatus; breakdown: CarbonCalculationBreakdown; duplicates: DuplicateSignal[] }>(
      `/api/mrv/${id}/calculate`
    ),
  tokenize: (id: string) => api.post<{ status: MrvStatus; assetId: string; txId: string }>(`/api/mrv/${id}/tokenize`),
  get: (id: string) => api.get<{ mrvRecord: MrvRecordDetail }>(`/api/mrv/${id}`),
  list: (params: { page?: number; pageSize?: number; status?: MrvStatus; ecosystemCode?: EcosystemCode } = {}) =>
    api.get<{ mrvRecords: MrvRecordSummary[]; page: number; pageSize: number }>(
      `/api/mrv?${new URLSearchParams(params as Record<string, string>).toString()}`
    ),
};

export const validationApi = {
  approve: (mrvId: string, reason?: string) =>
    api.post<{ status: MrvStatus }>(`/api/validation/${mrvId}/approve`, { reason }),
  reject: (mrvId: string, reason: string) =>
    api.post<{ status: MrvStatus }>(`/api/validation/${mrvId}/reject`, { reason }),
};

export const blockchainApi = {
  stats: () => api.get<{ transactionCount: number; tokenizedAssetCount: number }>('/api/blockchain/stats'),
  transactions: (params: { page?: number; pageSize?: number } = {}) =>
    api.get<{
      transactions: (BlockchainTransactionRef & { mrv_code: string; mrv_status: MrvStatus })[];
      page: number;
      pageSize: number;
    }>(`/api/blockchain/transactions?${new URLSearchParams(params as Record<string, string>).toString()}`),
  transaction: (txId: string) =>
    api.get<{
      transaction: BlockchainTransactionRef & {
        mrv_code: string;
        mrv_status: MrvStatus;
        estimated_carbon_tco2e: string;
        ecosystem_code: EcosystemCode;
        submitted_by_name: string | null;
      };
    }>(`/api/blockchain/transactions/${txId}`),
};

export const assetsApi = {
  get: (assetId: string) =>
    api.get<{
      asset: BlockchainAsset & {
        mrv_code: string;
        mrv_status: MrvStatus;
        estimated_carbon_tco2e: string;
        ecosystem_code: EcosystemCode;
        ecosystem_name: string;
        contributor_name: string;
      };
    }>(`/api/assets/${assetId}`),
};
