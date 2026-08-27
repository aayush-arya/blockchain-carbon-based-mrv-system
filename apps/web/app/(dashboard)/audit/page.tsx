'use client';

import { useState } from 'react';
import { auditApi } from '@/lib/endpoints';
import { useApiQuery } from '@/lib/useApiQuery';
import { formatDateTime } from '@/lib/utils';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ErrorState, PageLoading, EmptyState } from '@/components/ui/Feedback';

const PAGE_SIZE = 30;

export default function AuditCenterPage() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');

  const { data, error, isLoading, refetch } = useApiQuery(
    () => auditApi.list({ page, pageSize: PAGE_SIZE, action: action || undefined }),
    [page, action]
  );

  return (
    <div>
      <PageHeader title="Audit Center" description="Immutable log of every state-changing action across the platform." />

      <div className="px-8 py-6">
        <div className="mb-4 flex items-center gap-3">
          <Select
            className="w-56"
            value={action}
            onChange={(e) => {
              setPage(1);
              setAction(e.target.value);
            }}
          >
            <option value="">All actions</option>
            {data?.actions.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </Select>
        </div>

        {isLoading && <PageLoading label="Loading audit log…" />}
        {error && <ErrorState message={error} onRetry={refetch} />}

        {data && data.logs.length === 0 && <EmptyState title="No audit events" message="Nothing matches this filter." />}

        {data && data.logs.length > 0 && (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border-subtle bg-surface-sunken text-xs font-medium uppercase tracking-wide text-ink-faint">
                  <tr>
                    <th className="px-5 py-3">Actor</th>
                    <th className="px-5 py-3">Action</th>
                    <th className="px-5 py-3">Entity</th>
                    <th className="px-5 py-3">IP</th>
                    <th className="px-5 py-3">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {data.logs.map((log) => (
                    <tr key={log.id} className="hover:bg-surface-sunken">
                      <td className="px-5 py-3">
                        {log.actor_name ? (
                          <>
                            <p className="font-medium text-ink">{log.actor_name}</p>
                            <p className="text-xs capitalize text-ink-faint">{log.actor_role?.replace('_', ' ')}</p>
                          </>
                        ) : (
                          <span className="text-ink-faint">System</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <Badge tone="info">{log.action}</Badge>
                      </td>
                      <td className="px-5 py-3 font-mono text-xs text-ink-muted">
                        {log.entity_type}
                        {log.entity_id && <span className="text-ink-faint"> · {log.entity_id.slice(0, 8)}</span>}
                      </td>
                      <td className="px-5 py-3 font-mono text-xs text-ink-faint">{log.ip_address ?? '—'}</td>
                      <td className="px-5 py-3 text-ink-muted">{formatDateTime(log.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {data && (data.logs.length === PAGE_SIZE || page > 1) && (
          <div className="mt-4 flex items-center justify-between">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <span className="text-xs text-ink-faint">Page {page}</span>
            <Button variant="outline" size="sm" disabled={data.logs.length < PAGE_SIZE} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
