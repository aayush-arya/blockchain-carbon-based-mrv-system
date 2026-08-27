import { Router } from 'express';
import { env } from '../config/env';
import { checkDatabaseConnection } from '../db/client';
import { storage } from '../services/storageService';
import { asyncHandler } from '../utils/asyncHandler';

export const healthRouter = Router();

type ComponentStatus = 'ok' | 'error' | 'disabled';

async function checkComponents(): Promise<Record<string, { status: ComponentStatus; detail?: string }>> {
  const [dbOk, storageOk] = await Promise.all([checkDatabaseConnection(), storage.isHealthy()]);

  return {
    api: { status: 'ok' },
    database: dbOk
      ? { status: 'ok' }
      : { status: 'error', detail: 'Could not query the database. Is Postgres running?' },
    object_storage: storageOk
      ? { status: 'ok', detail: `driver=${env.STORAGE_DRIVER}` }
      : { status: 'error', detail: `driver=${env.STORAGE_DRIVER} unreachable` },
    ai_service: { status: 'disabled', detail: 'Wired up in a later phase.' },
    blockchain: env.FABRIC_ENABLED
      ? { status: 'disabled', detail: 'Fabric integration not wired up yet.' }
      : { status: 'disabled', detail: 'FABRIC_ENABLED=false' },
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
