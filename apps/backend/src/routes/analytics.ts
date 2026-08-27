import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { getDashboardAnalytics } from '../services/analyticsService';
import { asyncHandler } from '../utils/asyncHandler';

export const analyticsRouter = Router();

analyticsRouter.get(
  '/dashboard',
  authenticate,
  asyncHandler(async (_req, res) => {
    res.status(200).json(await getDashboardAnalytics());
  })
);
