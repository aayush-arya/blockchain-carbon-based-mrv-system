import { Router } from 'express';
import { z } from 'zod';
import {
  getBlockchainStats,
  getTransactionDetail,
  listRecentTransactions,
} from '../services/blockchainExplorerService';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';

export const blockchainRouter = Router();

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

blockchainRouter.get(
  '/stats',
  authenticate,
  asyncHandler(async (_req, res) => {
    res.status(200).json(await getBlockchainStats());
  })
);

blockchainRouter.get(
  '/transactions',
  authenticate,
  asyncHandler(async (req, res) => {
    const query = listQuerySchema.parse(req.query);
    const transactions = await listRecentTransactions(query);
    res.status(200).json({ transactions, page: query.page, pageSize: query.pageSize });
  })
);

blockchainRouter.get(
  '/transactions/:txId',
  authenticate,
  asyncHandler(async (req, res) => {
    const transaction = await getTransactionDetail(req.params.txId);
    res.status(200).json({ transaction });
  })
);
