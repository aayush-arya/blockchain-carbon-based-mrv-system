/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql('CREATE EXTENSION IF NOT EXISTS postgis;');
  pgm.sql('CREATE EXTENSION IF NOT EXISTS pgcrypto;');

  pgm.sql(`
    CREATE TYPE user_role AS ENUM ('field_operator', 'validator', 'admin');
  `);

  pgm.sql(`
    CREATE TYPE ecosystem_code AS ENUM ('mangrove', 'seagrass', 'salt_marsh');
  `);

  pgm.sql(`
    CREATE TYPE mrv_status AS ENUM (
      'draft',
      'submitted',
      'ai_analyzed',
      'pending_validation',
      'verified',
      'tokenized',
      'rejected'
    );
  `);

  pgm.sql(`
    CREATE TYPE validation_action AS ENUM ('approve', 'reject', 'flag_duplicate', 'comment');
  `);

  pgm.sql(`
    CREATE TYPE ledger_status AS ENUM ('pending', 'committed', 'failed');
  `);

  pgm.sql(`
    CREATE TYPE ai_model_mode AS ENUM ('heuristic', 'pretrained');
  `);

  pgm.sql(`
    CREATE TYPE notification_type AS ENUM (
      'observation_received',
      'ai_analysis_completed',
      'validation_required',
      'mrv_verified',
      'mrv_rejected',
      'blockchain_confirmed',
      'token_issued',
      'duplicate_suspected'
    );
  `);
};

exports.down = (pgm) => {
  pgm.sql('DROP TYPE IF EXISTS notification_type;');
  pgm.sql('DROP TYPE IF EXISTS ai_model_mode;');
  pgm.sql('DROP TYPE IF EXISTS ledger_status;');
  pgm.sql('DROP TYPE IF EXISTS validation_action;');
  pgm.sql('DROP TYPE IF EXISTS mrv_status;');
  pgm.sql('DROP TYPE IF EXISTS ecosystem_code;');
  pgm.sql('DROP TYPE IF EXISTS user_role;');
  // Extensions intentionally left installed on down (other objects may depend on them).
};
