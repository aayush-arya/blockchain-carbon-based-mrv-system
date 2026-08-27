import { Router } from 'express';
import { db } from '../db/client';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';

export const carbonRouter = Router();

carbonRouter.get(
  '/ecosystem-types',
  authenticate,
  asyncHandler(async (_req, res) => {
    const rows = await db
      .selectFrom('ecosystem_types')
      .select(['id', 'code', 'name', 'description'])
      .orderBy('name')
      .execute();
    res.status(200).json({ ecosystemTypes: rows });
  })
);

carbonRouter.get(
  '/factors',
  authenticate,
  asyncHandler(async (_req, res) => {
    const rows = await db
      .selectFrom('carbon_factors')
      .innerJoin('ecosystem_types', 'ecosystem_types.id', 'carbon_factors.ecosystem_type_id')
      .select([
        'carbon_factors.id as id',
        'ecosystem_types.code as ecosystem_code',
        'ecosystem_types.name as ecosystem_name',
        'carbon_factors.factor_value as factor_value',
        'carbon_factors.unit as unit',
        'carbon_factors.source as source',
        'carbon_factors.effective_date as effective_date',
        'carbon_factors.notes as notes',
        'carbon_factors.is_active as is_active',
      ])
      .orderBy('ecosystem_types.name')
      .orderBy('carbon_factors.effective_date', 'desc')
      .execute();
    res.status(200).json({ carbonFactors: rows });
  })
);
