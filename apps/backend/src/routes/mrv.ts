import { Router } from 'express';
import { authenticate, authorize, type AuthenticatedUser } from '../middleware/auth';
import { getObservationById } from '../services/observationService';
import {
  calculateMrvRecord,
  createDraftMrvRecord,
  getMrvOwnerContributorId,
  getMrvRecordDetail,
  listMrvRecords,
  runAiAnalysisForMrv,
  submitMrvRecord,
  tokenizeMrvRecord,
} from '../services/mrvService';
import { asyncHandler } from '../utils/asyncHandler';
import { ForbiddenError } from '../utils/errors';
import { createMrvRecordSchema, listMrvQuerySchema } from '../validators/mrvSchemas';

export const mrvRouter = Router();

function canAccessContributor(user: AuthenticatedUser, contributorId: string): boolean {
  return user.role === 'admin' || user.role === 'validator' || user.id === contributorId;
}

async function assertOwnerOrAdmin(user: AuthenticatedUser, mrvId: string): Promise<void> {
  if (user.role === 'admin') return;
  const contributorId = await getMrvOwnerContributorId(mrvId);
  if (contributorId !== user.id) {
    throw new ForbiddenError('You do not own this MRV record');
  }
}

mrvRouter.post(
  '/',
  authenticate,
  authorize('field_operator', 'admin'),
  asyncHandler(async (req, res) => {
    const { observationId } = createMrvRecordSchema.parse(req.body);
    if (req.user!.role !== 'admin') {
      const observation = await getObservationById(observationId);
      if (observation.contributor_id !== req.user!.id) {
        throw new ForbiddenError('You do not own this observation');
      }
    }
    const record = await createDraftMrvRecord(observationId, req.user!.id);
    res.status(201).json({ mrvRecord: record });
  })
);

mrvRouter.post(
  '/:id/submit',
  authenticate,
  authorize('field_operator', 'admin'),
  asyncHandler(async (req, res) => {
    await assertOwnerOrAdmin(req.user!, req.params.id);
    await submitMrvRecord(req.params.id, req.user!.id);
    res.status(200).json({ status: 'submitted' });
  })
);

mrvRouter.post(
  '/:id/analyze',
  authenticate,
  authorize('field_operator', 'admin'),
  asyncHandler(async (req, res) => {
    await assertOwnerOrAdmin(req.user!, req.params.id);
    const { analysisId, result } = await runAiAnalysisForMrv(req.params.id, req.user!.id);
    res.status(200).json({ status: 'ai_analyzed', analysisId, analysis: result });
  })
);

mrvRouter.post(
  '/:id/calculate',
  authenticate,
  authorize('field_operator', 'admin'),
  asyncHandler(async (req, res) => {
    await assertOwnerOrAdmin(req.user!, req.params.id);
    const { breakdown, duplicates } = await calculateMrvRecord(req.params.id, req.user!.id);
    res.status(200).json({ status: 'pending_validation', breakdown, duplicates });
  })
);

mrvRouter.post(
  '/:id/tokenize',
  authenticate,
  authorize('validator', 'admin'),
  asyncHandler(async (req, res) => {
    const result = await tokenizeMrvRecord(req.params.id, req.user!.id);
    res.status(200).json({ status: 'tokenized', ...result });
  })
);

mrvRouter.get(
  '/',
  authenticate,
  asyncHandler(async (req, res) => {
    const query = listMrvQuerySchema.parse(req.query);
    let contributorId = query.contributorId;
    if (req.user!.role === 'field_operator') {
      if (contributorId && contributorId !== req.user!.id) {
        throw new ForbiddenError('field_operator accounts may only list their own MRV records');
      }
      contributorId = req.user!.id;
    }

    const rows = await listMrvRecords({
      page: query.page,
      pageSize: query.pageSize,
      status: query.status,
      contributorId,
      ecosystemCode: query.ecosystemCode,
    });
    res.status(200).json({ mrvRecords: rows, page: query.page, pageSize: query.pageSize });
  })
);

mrvRouter.get(
  '/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    const detail = await getMrvRecordDetail(req.params.id);
    if (!canAccessContributor(req.user!, detail.observation.contributor_id)) {
      throw new ForbiddenError('You do not have access to this MRV record');
    }
    res.status(200).json({ mrvRecord: detail });
  })
);
