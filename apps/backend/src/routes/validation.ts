import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { approveMrvRecord, rejectMrvRecord } from '../services/mrvService';
import { asyncHandler } from '../utils/asyncHandler';
import { approveMrvSchema, rejectMrvSchema } from '../validators/mrvSchemas';

export const validationRouter = Router();

validationRouter.post(
  '/:mrvId/approve',
  authenticate,
  authorize('validator', 'admin'),
  asyncHandler(async (req, res) => {
    const { reason } = approveMrvSchema.parse(req.body);
    await approveMrvRecord(req.params.mrvId, req.user!.id, reason);
    res.status(200).json({ status: 'verified' });
  })
);

validationRouter.post(
  '/:mrvId/reject',
  authenticate,
  authorize('validator', 'admin'),
  asyncHandler(async (req, res) => {
    const { reason } = rejectMrvSchema.parse(req.body);
    await rejectMrvRecord(req.params.mrvId, req.user!.id, reason);
    res.status(200).json({ status: 'rejected' });
  })
);
