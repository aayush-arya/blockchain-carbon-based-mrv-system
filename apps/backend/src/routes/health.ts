import { Router } from 'express';
import { env } from '../config/env';
import { checkDatabaseConnection } from '../db/client';
import { asyncHandler } from '../utils/asyncHandler';

export const healthRouter = Router();

type ComponentStatus = 'ok' | 'error' | 'disabled';

async function checkComponents(): Promise<Record<string, { status: ComponentStatus; detail?: string }>> {
  const dbOk = await checkDatabaseConnection();

  return {
    api: { status: 'ok' },
    database: dbOk
      ? { status: 'ok' }
      : { status: 'error', detail: 'Could not query the database. Is Postgres running?' },
    object_storage: { status: 'disabled', detail: 'Wired up in a later phase.' },
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
