exports.shorthands = undefined;

// Refresh tokens are opaque random strings; only their SHA-256 hash is stored, so a database
// leak alone doesn't hand out usable tokens. Revocable server-side (unlike a stateless JWT
// refresh token), which is the whole point of using a table instead of a longer-lived JWT.
exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE refresh_tokens (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      revoked_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  pgm.sql('CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);');
  pgm.sql('CREATE INDEX idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);');
};

exports.down = (pgm) => {
  pgm.sql('DROP TABLE IF EXISTS refresh_tokens;');
};
