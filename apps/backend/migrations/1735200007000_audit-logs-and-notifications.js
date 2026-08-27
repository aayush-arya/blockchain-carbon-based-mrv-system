exports.shorthands = undefined;

exports.up = (pgm) => {
  // Independent of the domain tables on purpose: audit_logs should still tell the full
  // story even if a referenced row is later deleted, so no FK ON DELETE CASCADE here —
  // actor/entity ids are kept as plain UUIDs with soft references.
  pgm.sql(`
    CREATE TABLE audit_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id UUID,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      ip_address TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  pgm.sql('CREATE INDEX idx_audit_logs_actor_id ON audit_logs(actor_id);');
  pgm.sql('CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);');
  pgm.sql('CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);');

  pgm.sql(`
    CREATE TABLE notifications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type notification_type NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      related_entity_type TEXT,
      related_entity_id UUID,
      read_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  pgm.sql('CREATE INDEX idx_notifications_user_id ON notifications(user_id);');
  pgm.sql('CREATE INDEX idx_notifications_user_unread ON notifications(user_id) WHERE read_at IS NULL;');
};

exports.down = (pgm) => {
  pgm.sql('DROP TABLE IF EXISTS notifications;');
  pgm.sql('DROP TABLE IF EXISTS audit_logs;');
};
