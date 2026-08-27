exports.shorthands = undefined;

// blockchain_assets (migration 006) is asset-centric: one row per issued token. This is
// event-log-centric: one row per on-chain call for an MRV record (CreateMRVRecord,
// ValidateMRVRecord/RejectMRVRecord, IssueCarbonToken), which is what the blockchain explorer's
// "recent transactions" list and an MRV record's on-chain audit trail actually need.
exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE blockchain_transactions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      mrv_record_id UUID NOT NULL REFERENCES mrv_records(id) ON DELETE RESTRICT,
      chaincode_function TEXT NOT NULL,
      fabric_tx_id TEXT NOT NULL,
      channel_name TEXT NOT NULL,
      chaincode_name TEXT NOT NULL,
      submitted_by UUID REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  pgm.sql('CREATE INDEX idx_blockchain_transactions_mrv_record_id ON blockchain_transactions(mrv_record_id);');
  pgm.sql('CREATE INDEX idx_blockchain_transactions_fabric_tx_id ON blockchain_transactions(fabric_tx_id);');
  pgm.sql('CREATE INDEX idx_blockchain_transactions_created_at ON blockchain_transactions(created_at);');
};

exports.down = (pgm) => {
  pgm.sql('DROP TABLE IF EXISTS blockchain_transactions;');
};
