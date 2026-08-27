import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { db } from '../db/client';
import { storage } from '../services/storageService';
import { asyncHandler } from '../utils/asyncHandler';
import { ForbiddenError, NotFoundError } from '../utils/errors';

export const evidenceRouter = Router();

evidenceRouter.get(
  '/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    const evidence = await db
      .selectFrom('evidence_files')
      .innerJoin('field_observations', 'field_observations.id', 'evidence_files.observation_id')
      .select([
        'evidence_files.id as id',
        'evidence_files.storage_key as storage_key',
        'evidence_files.mime_type as mime_type',
        'field_observations.contributor_id as contributor_id',
      ])
      .where('evidence_files.id', '=', req.params.id)
      .executeTakeFirst();

    if (!evidence) {
      throw new NotFoundError('Evidence file', req.params.id);
    }

    const canAccess =
      req.user!.role === 'admin' || req.user!.role === 'validator' || req.user!.id === evidence.contributor_id;
    if (!canAccess) {
      throw new ForbiddenError('You do not have access to this evidence file');
    }

    const signedUrl = await storage.getSignedUrl(evidence.storage_key);
    if (signedUrl) {
      res.redirect(302, signedUrl);
      return;
    }

    const { stream, contentType, contentLength } = await storage.getReadStream(evidence.storage_key);
    res.setHeader('Content-Type', evidence.mime_type || contentType);
    res.setHeader('Content-Length', contentLength);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    stream.pipe(res);
  })
);
