exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE ai_analysis (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      observation_id UUID NOT NULL REFERENCES field_observations(id) ON DELETE CASCADE,
      evidence_file_id UUID NOT NULL REFERENCES evidence_files(id) ON DELETE CASCADE,
      model_name TEXT NOT NULL,
      model_mode ai_model_mode NOT NULL,
      predicted_ecosystem_type_id UUID REFERENCES ecosystem_types(id) ON DELETE SET NULL,
      confidence NUMERIC(5, 4) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
      vegetation_coverage_pct NUMERIC(5, 2) NOT NULL CHECK (vegetation_coverage_pct BETWEEN 0 AND 100),
      raw_output JSONB NOT NULL DEFAULT '{}'::jsonb,
      warnings TEXT[] NOT NULL DEFAULT '{}',
      inference_ms INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  pgm.sql('CREATE INDEX idx_ai_analysis_observation_id ON ai_analysis(observation_id);');
  pgm.sql('CREATE INDEX idx_ai_analysis_evidence_file_id ON ai_analysis(evidence_file_id);');

  pgm.sql(`
    CREATE TABLE mrv_records (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      mrv_code TEXT UNIQUE,
      observation_id UUID NOT NULL UNIQUE REFERENCES field_observations(id) ON DELETE RESTRICT,
      ai_analysis_id UUID REFERENCES ai_analysis(id) ON DELETE SET NULL,
      status mrv_status NOT NULL DEFAULT 'draft',
      carbon_factor_id UUID REFERENCES carbon_factors(id) ON DELETE RESTRICT,
      estimated_area_m2 NUMERIC(12, 2),
      vegetation_coverage_pct NUMERIC(5, 2),
      estimated_carbon_tco2e NUMERIC(14, 4),
      calculation_breakdown JSONB,
      duplicate_of_mrv_id UUID REFERENCES mrv_records(id) ON DELETE SET NULL,
      duplicate_reason TEXT,
      rejection_reason TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  pgm.sql('CREATE INDEX idx_mrv_records_status ON mrv_records(status);');
  pgm.sql('CREATE INDEX idx_mrv_records_ai_analysis_id ON mrv_records(ai_analysis_id);');
  pgm.sql('CREATE INDEX idx_mrv_records_carbon_factor_id ON mrv_records(carbon_factor_id);');
  pgm.sql('CREATE INDEX idx_mrv_records_duplicate_of_mrv_id ON mrv_records(duplicate_of_mrv_id);');

  pgm.sql(`
    CREATE TRIGGER trg_mrv_records_updated_at
    BEFORE UPDATE ON mrv_records
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  `);

  // Human-readable sequential codes, e.g. MRV-000241, generated server-side so the app
  // never has to coordinate uniqueness itself.
  pgm.sql('CREATE SEQUENCE mrv_code_seq START 1;');
  pgm.sql(`
    CREATE OR REPLACE FUNCTION generate_mrv_code() RETURNS TRIGGER AS $$
    BEGIN
      IF NEW.mrv_code IS NULL THEN
        NEW.mrv_code := 'MRV-' || LPAD(nextval('mrv_code_seq')::TEXT, 6, '0');
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);
  pgm.sql(`
    CREATE TRIGGER trg_mrv_records_code
    BEFORE INSERT ON mrv_records
    FOR EACH ROW EXECUTE FUNCTION generate_mrv_code();
  `);
};

exports.down = (pgm) => {
  pgm.sql('DROP TABLE IF EXISTS mrv_records;');
  pgm.sql('DROP FUNCTION IF EXISTS generate_mrv_code() CASCADE;');
  pgm.sql('DROP SEQUENCE IF EXISTS mrv_code_seq;');
  pgm.sql('DROP TABLE IF EXISTS ai_analysis;');
};
