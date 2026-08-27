import cors from 'cors';
import express, { type Express } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { env } from './config/env';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { requestId } from './middleware/requestId';
import { assetsRouter } from './routes/assets';
import { authRouter } from './routes/auth';
import { blockchainRouter } from './routes/blockchain';
import { carbonRouter } from './routes/carbon';
import { evidenceRouter } from './routes/evidence';
import { healthRouter } from './routes/health';
import { mrvRouter } from './routes/mrv';
import { observationsRouter } from './routes/observations';
import { validationRouter } from './routes/validation';
import { logger } from './utils/logger';

export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(requestId);
  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
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

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
