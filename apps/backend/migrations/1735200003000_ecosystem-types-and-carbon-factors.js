exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE ecosystem_types (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code ecosystem_code NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  // Carbon factors are versioned, never mutated in place: a new row supersedes an old one
  // (is_active = false), so historical MRV records keep pointing at the exact factor that
  // was used when their carbon estimate was calculated. See docs/CARBON_METHODOLOGY.md.
  pgm.sql(`
    CREATE TABLE carbon_factors (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      ecosystem_type_id UUID NOT NULL REFERENCES ecosystem_types(id) ON DELETE RESTRICT,
      factor_value NUMERIC(10, 4) NOT NULL CHECK (factor_value > 0),
      unit TEXT NOT NULL,
      source TEXT NOT NULL,
      effective_date DATE NOT NULL,
      notes TEXT,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  pgm.sql('CREATE INDEX idx_carbon_factors_ecosystem_type_id ON carbon_factors(ecosystem_type_id);');
  pgm.sql(
    'CREATE UNIQUE INDEX idx_carbon_factors_one_active_per_ecosystem ON carbon_factors(ecosystem_type_id) WHERE is_active;'
  );

  pgm.sql(`
    INSERT INTO ecosystem_types (code, name, description) VALUES
      ('mangrove', 'Mangrove Forest', 'Coastal forested wetland dominated by salt-tolerant trees and shrubs.'),
      ('seagrass', 'Seagrass Meadow', 'Submerged marine flowering plants forming dense underwater meadows.'),
      ('salt_marsh', 'Tidal Salt Marsh', 'Intertidal wetland dominated by salt-tolerant grasses and herbs.');
  `);

  // PLACEHOLDER factors so the calculation pipeline is runnable end-to-end immediately.
  // These are illustrative order-of-magnitude figures, NOT verified IPCC/NCCR citations —
  // see docs/CARBON_METHODOLOGY.md, which replaces them with properly sourced values in a
  // later migration once that research is done. Every row's `source`/`notes` says so
  // explicitly so nobody downstream mistakes this for a validated figure.
  pgm.sql(`
    INSERT INTO carbon_factors (ecosystem_type_id, factor_value, unit, source, effective_date, notes, is_active)
    SELECT id, 6.0, 'tCO2e/ha/yr', 'PLACEHOLDER - not yet verified against a primary source', '2026-01-01',
      'PLACEHOLDER value pending literature-backed replacement in docs/CARBON_METHODOLOGY.md. Do not use for real carbon accounting.', true
    FROM ecosystem_types WHERE code = 'mangrove';
  `);
  pgm.sql(`
    INSERT INTO carbon_factors (ecosystem_type_id, factor_value, unit, source, effective_date, notes, is_active)
    SELECT id, 3.0, 'tCO2e/ha/yr', 'PLACEHOLDER - not yet verified against a primary source', '2026-01-01',
      'PLACEHOLDER value pending literature-backed replacement in docs/CARBON_METHODOLOGY.md. Do not use for real carbon accounting.', true
    FROM ecosystem_types WHERE code = 'seagrass';
  `);
  pgm.sql(`
    INSERT INTO carbon_factors (ecosystem_type_id, factor_value, unit, source, effective_date, notes, is_active)
    SELECT id, 4.0, 'tCO2e/ha/yr', 'PLACEHOLDER - not yet verified against a primary source', '2026-01-01',
      'PLACEHOLDER value pending literature-backed replacement in docs/CARBON_METHODOLOGY.md. Do not use for real carbon accounting.', true
    FROM ecosystem_types WHERE code = 'salt_marsh';
  `);
};

exports.down = (pgm) => {
  pgm.sql('DROP TABLE IF EXISTS carbon_factors;');
  pgm.sql('DROP TABLE IF EXISTS ecosystem_types;');
};
