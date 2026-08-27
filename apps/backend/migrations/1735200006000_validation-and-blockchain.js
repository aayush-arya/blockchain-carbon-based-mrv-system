exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE validation_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      mrv_record_id UUID NOT NULL REFERENCES mrv_records(id) ON DELETE CASCADE,
      validator_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      action validation_action NOT NULL,
      reason TEXT,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  pgm.sql('CREATE INDEX idx_validation_events_mrv_record_id ON validation_events(mrv_record_id);');
  pgm.sql('CREATE INDEX idx_validation_events_validator_id ON validation_events(validator_id);');

  // One blockchain asset per MRV record — the UNIQUE constraint is a second line of defense
  // against double-tokenization alongside the chaincode's own check.
  pgm.sql(`
    CREATE TABLE blockchain_assets (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      mrv_record_id UUID NOT NULL UNIQUE REFERENCES mrv_records(id) ON DELETE RESTRICT,
      asset_id TEXT NOT NULL UNIQUE,
      fabric_tx_id TEXT NOT NULL,
      channel_name TEXT NOT NULL,
      chaincode_name TEXT NOT NULL,
      evidence_hash TEXT NOT NULL,
      metadata_hash TEXT NOT NULL,
      block_number BIGINT,
      ledger_status ledger_status NOT NULL DEFAULT 'pending',
      committed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  pgm.sql('CREATE INDEX idx_blockchain_assets_fabric_tx_id ON blockchain_assets(fabric_tx_id);');
  pgm.sql('CREATE INDEX idx_blockchain_assets_ledger_status ON blockchain_assets(ledger_status);');
};

exports.down = (pgm) => {
  pgm.sql('DROP TABLE IF EXISTS blockchain_assets;');
  pgm.sql('DROP TABLE IF EXISTS validation_events;');
};
