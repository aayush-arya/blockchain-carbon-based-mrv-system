import { db } from '../db/client';

interface RecordAuditEventInput {
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
}

/** Every state-changing action in the app should call this — see docs/ARCHITECTURE.md. */
export async function recordAuditEvent(input: RecordAuditEventInput): Promise<void> {
  await db
    .insertInto('audit_logs')
    .values({
      actor_id: input.actorId,
      action: input.action,
      entity_type: input.entityType,
      entity_id: input.entityId,
      metadata: input.metadata ?? {},
      ip_address: input.ipAddress ?? null,
    })
    .execute();
}
