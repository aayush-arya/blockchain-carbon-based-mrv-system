import { z } from 'zod';

// multipart/form-data fields arrive as strings, hence z.coerce throughout.
export const createObservationSchema = z.object({
  ecosystemCode: z.enum(['mangrove', 'seagrass', 'salt_marsh']),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  capturedAt: z.coerce.date(),
  reportedAreaM2: z.coerce.number().positive().max(1_000_000),
  notes: z.string().max(2000).optional(),
});

export const listObservationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  ecosystemCode: z.enum(['mangrove', 'seagrass', 'salt_marsh']).optional(),
  contributorId: z.string().uuid().optional(),
  minLat: z.coerce.number().min(-90).max(90).optional(),
  minLng: z.coerce.number().min(-180).max(180).optional(),
  maxLat: z.coerce.number().min(-90).max(90).optional(),
  maxLng: z.coerce.number().min(-180).max(180).optional(),
});
