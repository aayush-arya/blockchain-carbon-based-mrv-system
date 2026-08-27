import { db } from '../db/client';

export interface ListAuditLogsFilters {
  page: number;
  pageSize: number;
  action?: string;
  entityType?: string;
  actorId?: string;
}

export async function listAuditLogs(filters: ListAuditLogsFilters) {
  let query = db
    .selectFrom('audit_logs')
    .leftJoin('users', 'users.id', 'audit_logs.actor_id')
    .select([
      'audit_logs.id as id',
      'audit_logs.action as action',
      'audit_logs.entity_type as entity_type',
      'audit_logs.entity_id as entity_id',
      'audit_logs.metadata as metadata',
      'audit_logs.ip_address as ip_address',
      'audit_logs.created_at as created_at',
      'audit_logs.actor_id as actor_id',
      'users.full_name as actor_name',
      'users.role as actor_role',
    ]);

  if (filters.action) query = query.where('audit_logs.action', '=', filters.action);
  if (filters.entityType) query = query.where('audit_logs.entity_type', '=', filters.entityType);
  if (filters.actorId) query = query.where('audit_logs.actor_id', '=', filters.actorId);

  return query
    .orderBy('audit_logs.created_at', 'desc')
    .limit(filters.pageSize)
    .offset((filters.page - 1) * filters.pageSize)
    .execute();
}

export async function listAuditActions(): Promise<string[]> {
  const rows = await db.selectFrom('audit_logs').select('action').distinct().orderBy('action', 'asc').execute();
  return rows.map((r) => r.action);
}

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
