exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE field_observations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      contributor_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
      ecosystem_type_id UUID NOT NULL REFERENCES ecosystem_types(id) ON DELETE RESTRICT,
      location GEOGRAPHY(Point, 4326) NOT NULL,
      captured_at TIMESTAMPTZ NOT NULL,
      notes TEXT,
      reported_area_m2 NUMERIC(12, 2),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  pgm.sql('CREATE INDEX idx_field_observations_location ON field_observations USING GIST(location);');
  pgm.sql('CREATE INDEX idx_field_observations_contributor_id ON field_observations(contributor_id);');
  pgm.sql('CREATE INDEX idx_field_observations_ecosystem_type_id ON field_observations(ecosystem_type_id);');
  pgm.sql('CREATE INDEX idx_field_observations_captured_at ON field_observations(captured_at);');
  pgm.sql(
    'CREATE INDEX idx_field_observations_contributor_captured ON field_observations(contributor_id, captured_at);'
  );
  pgm.sql(`
    CREATE TRIGGER trg_field_observations_updated_at
    BEFORE UPDATE ON field_observations
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  `);

  pgm.sql(`
    CREATE TABLE evidence_files (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      observation_id UUID NOT NULL REFERENCES field_observations(id) ON DELETE CASCADE,
      storage_key TEXT NOT NULL,
      original_filename TEXT,
      mime_type TEXT NOT NULL,
      file_size_bytes BIGINT NOT NULL,
      sha256_hash TEXT NOT NULL,
      uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  pgm.sql('CREATE INDEX idx_evidence_files_observation_id ON evidence_files(observation_id);');
  pgm.sql('CREATE INDEX idx_evidence_files_sha256_hash ON evidence_files(sha256_hash);');
};

exports.down = (pgm) => {
  pgm.sql('DROP TABLE IF EXISTS evidence_files;');
  pgm.sql('DROP TABLE IF EXISTS field_observations;');
};
