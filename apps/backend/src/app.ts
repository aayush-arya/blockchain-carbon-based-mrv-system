import { readFileSync } from 'node:fs';
import path from 'node:path';
import cors from 'cors';
import express, { type Express } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { load as loadYaml } from 'js-yaml';
import pinoHttp from 'pino-http';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { requestId } from './middleware/requestId';
import { analyticsRouter } from './routes/analytics';
import { assetsRouter } from './routes/assets';
import { auditRouter } from './routes/audit';
import { authRouter } from './routes/auth';
import { blockchainRouter } from './routes/blockchain';
import { carbonRouter } from './routes/carbon';
import { evidenceRouter } from './routes/evidence';
import { healthRouter } from './routes/health';
import { mrvRouter } from './routes/mrv';
import { observationsRouter } from './routes/observations';
import { validationRouter } from './routes/validation';
import { logger } from './utils/logger';

// Lives alongside this file in both dev (src/) and production (dist/, copied there by the
// build script - see package.json) so the same relative path resolves in both.
const openApiDocument = loadYaml(readFileSync(path.resolve(__dirname, 'openapi.yaml'), 'utf8')) as object;

export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(requestId);

  // Ahead of helmet(): Swagger UI's own bundle relies on an inline init script, which
  // helmet's default script-src 'self' CSP would block. Lower security bar is fine for a docs
  // page that renders static reference content and never touches user data itself.
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiDocument));

  app.use(helmet());
  app.use(
    cors({
      // In development, allow any localhost port (the dashboard's dev server port can shift
      // when the default is taken) rather than one fixed origin. Production stays a single
      // configured origin.
      origin:
        env.NODE_ENV === 'development'
          ? /^https?:\/\/localhost:\d+$/
          : env.CORS_ORIGIN,
      credentials: true,
    })
  );
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => (req as express.Request).requestId,
      customLogLevel: (_req, res, err) => {
        if (err || res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },
    })
  );
  app.use(
    rateLimit({
      windowMs: env.RATE_LIMIT_WINDOW_MS,
      max: env.RATE_LIMIT_MAX_REQUESTS,
      standardHeaders: true,
      legacyHeaders: false,
    })
  );
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));

  app.use('/api/system', healthRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/observations', observationsRouter);
  app.use('/api/evidence', evidenceRouter);
  app.use('/api/carbon', carbonRouter);
  app.use('/api/mrv', mrvRouter);
  app.use('/api/validation', validationRouter);
  app.use('/api/blockchain', blockchainRouter);
  app.use('/api/assets', assetsRouter);
  app.use('/api/analytics', analyticsRouter);
  app.use('/api/audit', auditRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
