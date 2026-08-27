import { Router } from 'express';
import { env } from '../config/env';
import { checkDatabaseConnection } from '../db/client';
import { checkFabricHealth } from '../services/fabricService';
import { checkMlServiceHealth } from '../services/mlClient';
import { storage } from '../services/storageService';
import { asyncHandler } from '../utils/asyncHandler';

export const healthRouter = Router();

type ComponentStatus = 'ok' | 'error' | 'disabled';

async function checkComponents(): Promise<Record<string, { status: ComponentStatus; detail?: string }>> {
  const [dbOk, storageOk, aiOk, fabricOk] = await Promise.all([
    checkDatabaseConnection(),
    storage.isHealthy(),
    checkMlServiceHealth(),
    checkFabricHealth(),
  ]);

  return {
    api: { status: 'ok' },
    database: dbOk
      ? { status: 'ok' }
      : { status: 'error', detail: 'Could not query the database. Is Postgres running?' },
    object_storage: storageOk
      ? { status: 'ok', detail: `driver=${env.STORAGE_DRIVER}` }
      : { status: 'error', detail: `driver=${env.STORAGE_DRIVER} unreachable` },
    ai_service: aiOk
      ? { status: 'ok' }
      : { status: 'error', detail: `Could not reach ${env.ML_SERVICE_URL}` },
    blockchain: !env.FABRIC_ENABLED
      ? { status: 'disabled', detail: 'FABRIC_ENABLED=false' }
      : fabricOk
        ? { status: 'ok', detail: `channel=${env.FABRIC_CHANNEL_NAME}` }
        : { status: 'error', detail: 'Could not reach the Fabric network/chaincode' },
  };
}

healthRouter.get(
  '/health',
  asyncHandler(async (_req, res) => {
    const components = await checkComponents();
    const healthy = Object.values(components).every((c) => c.status !== 'error');
    res.status(healthy ? 200 : 503).json({
      status: healthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      components,
    });
  })
);
