import { describe, expect, it } from 'vitest';
import { computeCarbonBreakdown } from '../src/services/carbonCalculationService';

const mangroveFactor = {
  ecosystemCode: 'mangrove' as const,
  factorValue: 6.0,
  factorUnit: 'tCO2e/ha/yr',
  factorSource: 'PLACEHOLDER - not yet verified against a primary source',
};

describe('computeCarbonBreakdown', () => {
  it('computes effective area and carbon estimate from coverage % and reported area', () => {
    const result = computeCarbonBreakdown(
      { vegetationCoveragePct: 50, reportedAreaM2: 100 },
      mangroveFactor
    );

    // 100 m² × 50% = 50 m² = 0.005 ha; 0.005 ha × 6.0 tCO2e/ha/yr = 0.03 tCO2e
    expect(result.effective_area_m2).toBe(50);
    expect(result.estimated_carbon_tco2e).toBe(0.03);
    expect(result.carbon_factor_value).toBe(6.0);
    expect(result.formula).toContain('ANNUAL');
  });

  it('is zero when coverage is 0%', () => {
    const result = computeCarbonBreakdown({ vegetationCoveragePct: 0, reportedAreaM2: 100 }, mangroveFactor);
    expect(result.effective_area_m2).toBe(0);
    expect(result.estimated_carbon_tco2e).toBe(0);
  });

  it('uses the full reported area when coverage is 100%', () => {
    const result = computeCarbonBreakdown({ vegetationCoveragePct: 100, reportedAreaM2: 250 }, mangroveFactor);
    expect(result.effective_area_m2).toBe(250);
  });

  it('rejects out-of-range coverage percentages', () => {
    expect(() => computeCarbonBreakdown({ vegetationCoveragePct: 101, reportedAreaM2: 100 }, mangroveFactor)).toThrow();
    expect(() => computeCarbonBreakdown({ vegetationCoveragePct: -1, reportedAreaM2: 100 }, mangroveFactor)).toThrow();
  });

  it('rejects non-positive reported area', () => {
    expect(() => computeCarbonBreakdown({ vegetationCoveragePct: 50, reportedAreaM2: 0 }, mangroveFactor)).toThrow();
    expect(() =>
      computeCarbonBreakdown({ vegetationCoveragePct: 50, reportedAreaM2: -10 }, mangroveFactor)
    ).toThrow();
  });

  it('scales linearly with the carbon factor value', () => {
    const doubled = computeCarbonBreakdown(
      { vegetationCoveragePct: 50, reportedAreaM2: 100 },
      { ...mangroveFactor, factorValue: 12.0 }
    );
    expect(doubled.estimated_carbon_tco2e).toBe(0.06);
  });
});
