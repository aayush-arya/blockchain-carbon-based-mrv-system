import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  authenticateUser,
  getUserById,
  refreshTokens,
  registerUser,
  revokeRefreshToken,
} from '../services/authService';
import { recordAuditEvent } from '../services/auditService';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { loginSchema, refreshSchema, registerSchema } from '../validators/authSchemas';

export const authRouter = Router();

// Login/register are the highest-value brute-force target in the app, so they get a tighter
// limit than the global rate limiter in app.ts.
const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

authRouter.post(
  '/register',
  authRateLimit,
  asyncHandler(async (req, res) => {
    const input = registerSchema.parse(req.body);
    const { user, tokens } = await registerUser(input);
    await recordAuditEvent({
      actorId: user.id,
      action: 'user.register',
      entityType: 'users',
      entityId: user.id,
      ipAddress: req.ip,
    });
    res.status(201).json({ user, tokens });
  })
);

authRouter.post(
  '/login',
  authRateLimit,
  asyncHandler(async (req, res) => {
    const input = loginSchema.parse(req.body);
    const { user, tokens } = await authenticateUser(input);
    await recordAuditEvent({
      actorId: user.id,
      action: 'user.login',
      entityType: 'users',
      entityId: user.id,
      ipAddress: req.ip,
    });
    res.status(200).json({ user, tokens });
  })
);

authRouter.post(
  '/refresh',
  authRateLimit,
  asyncHandler(async (req, res) => {
    const { refreshToken } = refreshSchema.parse(req.body);
    const { user, tokens } = await refreshTokens(refreshToken);
    res.status(200).json({ user, tokens });
  })
);

authRouter.post(
  '/logout',
  asyncHandler(async (req, res) => {
    const { refreshToken } = refreshSchema.parse(req.body);
    await revokeRefreshToken(refreshToken);
    res.status(204).send();
  })
);

authRouter.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    const user = await getUserById(req.user!.id);
    res.status(200).json({ user });
  })
);
