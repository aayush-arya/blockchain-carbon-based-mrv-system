import { env } from '../config/env';
import type { AiModelMode, EcosystemCode } from '../db/types';
import { AppError } from '../utils/errors';

export interface MlAnalysisResult {
  modelName: string;
  modelMode: AiModelMode;
  predictedEcosystem: EcosystemCode;
  confidence: number;
  vegetationCoveragePct: number;
  inferenceMs: number;
  warnings: string[];
  explanation: Record<string, unknown>;
}

interface MlAnalyzeApiResponse {
  model_name: string;
  model_mode: AiModelMode;
  predicted_ecosystem: EcosystemCode;
  confidence: number;
  vegetation_coverage_pct: number;
  inference_ms: number;
  warnings: string[];
  explanation: Record<string, unknown>;
}

export async function analyzeImage(buffer: Buffer, mimeType: string, filename: string): Promise<MlAnalysisResult> {
  const formData = new FormData();
  formData.append('image', new Blob([new Uint8Array(buffer)], { type: mimeType }), filename);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.ML_SERVICE_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${env.ML_SERVICE_URL}/analyze`, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });
  } catch (err) {
    throw new AppError(502, 'AI_SERVICE_UNREACHABLE', 'Could not reach the AI/ML service', {
      cause: err instanceof Error ? err.message : String(err),
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new AppError(502, 'AI_SERVICE_ERROR', `AI service returned ${response.status}`, { body });
  }

  const data = (await response.json()) as MlAnalyzeApiResponse;

  return {
    modelName: data.model_name,
    modelMode: data.model_mode,
    predictedEcosystem: data.predicted_ecosystem,
    confidence: data.confidence,
    vegetationCoveragePct: data.vegetation_coverage_pct,
    inferenceMs: data.inference_ms,
    warnings: data.warnings,
    explanation: data.explanation,
  };
}

export async function checkMlServiceHealth(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const response = await fetch(`${env.ML_SERVICE_URL}/health`, { signal: controller.signal });
    clearTimeout(timeout);
    return response.ok;
  } catch {
    return false;
  }
}
