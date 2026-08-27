import { Router } from 'express';
import { authenticate, authorize, type AuthenticatedUser } from '../middleware/auth';
import { evidenceUpload } from '../middleware/upload';
import { recordAuditEvent } from '../services/auditService';
import { createObservation, getObservationById, listObservations } from '../services/observationService';
import { asyncHandler } from '../utils/asyncHandler';
import { ForbiddenError, ValidationError } from '../utils/errors';
import { createObservationSchema, listObservationsQuerySchema } from '../validators/observationSchemas';

export const observationsRouter = Router();

function canAccessContributor(user: AuthenticatedUser, contributorId: string): boolean {
  return user.role === 'admin' || user.role === 'validator' || user.id === contributorId;
}

observationsRouter.post(
  '/',
  authenticate,
  authorize('field_operator', 'admin'),
  evidenceUpload.single('image'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw new ValidationError('An "image" file is required');
    }
    const input = createObservationSchema.parse(req.body);

    const result = await createObservation({
      contributorId: req.user!.id,
      organizationId: req.user!.organizationId,
      ecosystemCode: input.ecosystemCode,
      latitude: input.latitude,
      longitude: input.longitude,
      capturedAt: input.capturedAt,
      reportedAreaM2: input.reportedAreaM2,
      notes: input.notes,
      file: {
        buffer: req.file.buffer,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
      },
    });

    await recordAuditEvent({
      actorId: req.user!.id,
      action: 'observation.create',
      entityType: 'field_observations',
      entityId: result.observationId,
      metadata: { evidenceFileId: result.evidenceFileId, exactHashDuplicate: Boolean(result.duplicateOf) },
      ipAddress: req.ip,
    });

    res.status(201).json({
      observationId: result.observationId,
      evidenceFileId: result.evidenceFileId,
      sha256: result.sha256,
      duplicateWarning: result.duplicateOf
        ? {
            message: `This exact image was already submitted as part of observation ${result.duplicateOf.observationId}.`,
            observationId: result.duplicateOf.observationId,
            uploadedAt: result.duplicateOf.uploadedAt,
          }
        : null,
    });
  })
);

observationsRouter.get(
  '/',
  authenticate,
  asyncHandler(async (req, res) => {
    const query = listObservationsQuerySchema.parse(req.query);

    // field_operators only ever see their own submissions unless they explicitly aren't
    // asking for someone else's (which they're not allowed to do anyway).
    let contributorId = query.contributorId;
    if (req.user!.role === 'field_operator') {
      if (contributorId && contributorId !== req.user!.id) {
        throw new ForbiddenError('field_operator accounts may only list their own observations');
      }
      contributorId = req.user!.id;
    }

    const bounds =
      query.minLat !== undefined && query.minLng !== undefined && query.maxLat !== undefined && query.maxLng !== undefined
        ? { minLat: query.minLat, minLng: query.minLng, maxLat: query.maxLat, maxLng: query.maxLng }
        : undefined;

    const rows = await listObservations({
      page: query.page,
      pageSize: query.pageSize,
      ecosystemCode: query.ecosystemCode,
      contributorId,
      bounds,
    });

    res.status(200).json({ observations: rows, page: query.page, pageSize: query.pageSize });
  })
);

observationsRouter.get(
  '/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    const observation = await getObservationById(req.params.id);
    if (!canAccessContributor(req.user!, observation.contributor_id)) {
      throw new ForbiddenError('You do not have access to this observation');
    }
    res.status(200).json({ observation });
  })
);
