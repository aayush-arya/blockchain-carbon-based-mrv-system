import { Router } from 'express';
import { getAssetDetail } from '../services/blockchainExplorerService';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';

export const assetsRouter = Router();

assetsRouter.get(
  '/:assetId',
  authenticate,
  asyncHandler(async (req, res) => {
    const asset = await getAssetDetail(req.params.assetId);
    res.status(200).json({ asset });
  })
);
