import { Router } from 'express';
import { z } from 'zod';
import { authenticate, authorize } from '../middleware/auth';
import { listAuditActions, listAuditLogs } from '../services/auditService';
import { asyncHandler } from '../utils/asyncHandler';

export const auditRouter = Router();

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  action: z.string().min(1).optional(),
  entityType: z.string().min(1).optional(),
  actorId: z.string().uuid().optional(),
});

auditRouter.get(
  '/',
  authenticate,
  authorize('validator', 'admin'),
  asyncHandler(async (req, res) => {
    const query = listQuerySchema.parse(req.query);
    const [logs, actions] = await Promise.all([listAuditLogs(query), listAuditActions()]);
    res.status(200).json({ logs, actions, page: query.page, pageSize: query.pageSize });
  })
);
