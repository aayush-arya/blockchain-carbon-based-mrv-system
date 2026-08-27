import { z } from 'zod';

export const createMrvRecordSchema = z.object({
  observationId: z.string().uuid(),
});

export const listMrvQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z
    .enum(['draft', 'submitted', 'ai_analyzed', 'pending_validation', 'verified', 'tokenized', 'rejected'])
    .optional(),
  contributorId: z.string().uuid().optional(),
  ecosystemCode: z.enum(['mangrove', 'seagrass', 'salt_marsh']).optional(),
});

export const approveMrvSchema = z.object({
  reason: z.string().max(2000).optional(),
});

export const rejectMrvSchema = z.object({
  reason: z.string().min(3, 'A rejection reason is required').max(2000),
});
