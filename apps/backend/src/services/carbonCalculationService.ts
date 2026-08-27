import { db } from '../db/client';
import type { CarbonCalculationBreakdown, EcosystemCode } from '../db/types';
import { NotFoundError, ValidationError } from '../utils/errors';
import { round } from '../utils/math';

export interface CarbonFactorInput {
  ecosystemCode: EcosystemCode;
  factorValue: number;
  factorUnit: string;
  factorSource: string;
}

export interface CarbonCalculationInput {
  vegetationCoveragePct: number;
  reportedAreaM2: number;
}

/**
 * Pure calculation core — no I/O, fully unit-testable. Deliberately explicit about the fact
 * that this is an *annual sequestration rate* estimate (tCO2e/ha/yr × area), not a cumulative
 * carbon stock, because the two are easy to conflate and the difference matters for anyone
 * reading the number. See docs/CARBON_METHODOLOGY.md.
 */
export function computeCarbonBreakdown(
  input: CarbonCalculationInput,
  factor: CarbonFactorInput
): CarbonCalculationBreakdown {
  if (input.vegetationCoveragePct < 0 || input.vegetationCoveragePct > 100) {
    throw new ValidationError('vegetationCoveragePct must be between 0 and 100');
  }
  if (input.reportedAreaM2 <= 0) {
    throw new ValidationError('reportedAreaM2 must be greater than 0');
  }
  if (factor.factorValue <= 0) {
    throw new ValidationError('carbon factor must be greater than 0');
  }

  const effectiveAreaM2 = round(input.reportedAreaM2 * (input.vegetationCoveragePct / 100), 2);
  const effectiveAreaHa = effectiveAreaM2 / 10000;
  const estimatedCarbonTco2e = round(effectiveAreaHa * factor.factorValue, 4);

  const formula =
    `effective_area_m2 = reported_area_m2 (${input.reportedAreaM2}) × coverage (${input.vegetationCoveragePct}%) = ${effectiveAreaM2} m² ` +
    `(${round(effectiveAreaHa, 4)} ha); estimated_carbon_tco2e = ${round(effectiveAreaHa, 4)} ha × ${factor.factorValue} ${factor.factorUnit} ` +
    `= ${estimatedCarbonTco2e} tCO2e. This is an ANNUAL sequestration-rate estimate (the factor's "/yr" unit), not a cumulative carbon stock.`;

  return {
    ecosystem_code: factor.ecosystemCode,
    vegetation_coverage_pct: input.vegetationCoveragePct,
    reported_area_m2: input.reportedAreaM2,
    effective_area_m2: effectiveAreaM2,
    carbon_factor_value: factor.factorValue,
    carbon_factor_unit: factor.factorUnit,
    carbon_factor_source: factor.factorSource,
    formula,
    estimated_carbon_tco2e: estimatedCarbonTco2e,
    calculated_at: new Date().toISOString(),
  };
}

/** Fetches the active, versioned carbon factor for an ecosystem type and runs the calculation. */
export async function calculateCarbonEstimate(
  ecosystemTypeId: string,
  input: CarbonCalculationInput
): Promise<{ breakdown: CarbonCalculationBreakdown; carbonFactorId: string }> {
  const factorRow = await db
    .selectFrom('carbon_factors')
    .innerJoin('ecosystem_types', 'ecosystem_types.id', 'carbon_factors.ecosystem_type_id')
    .select([
      'carbon_factors.id as id',
      'carbon_factors.factor_value as factor_value',
      'carbon_factors.unit as unit',
      'carbon_factors.source as source',
      'ecosystem_types.code as code',
    ])
    .where('carbon_factors.ecosystem_type_id', '=', ecosystemTypeId)
    .where('carbon_factors.is_active', '=', true)
    .executeTakeFirst();

  if (!factorRow) {
    throw new NotFoundError('Active carbon factor for ecosystem type', ecosystemTypeId);
  }

  const breakdown = computeCarbonBreakdown(input, {
    ecosystemCode: factorRow.code,
    factorValue: Number(factorRow.factor_value),
    factorUnit: factorRow.unit,
    factorSource: factorRow.source,
  });

  return { breakdown, carbonFactorId: factorRow.id };
}
