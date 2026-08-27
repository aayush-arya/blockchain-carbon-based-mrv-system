'use client';

import Link from 'next/link';
import { useState } from 'react';
import { observationsApi } from '@/lib/endpoints';
import { useApiQuery } from '@/lib/useApiQuery';
import { ECOSYSTEM_LABELS, formatDateTime, formatNumber } from '@/lib/utils';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { Card } from '@/components/ui/Card';
import { Select } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ErrorState, PageLoading, EmptyState } from '@/components/ui/Feedback';
import type { EcosystemCode } from '@/lib/types';

const PAGE_SIZE = 20;

export default function ObservationsPage() {
  const [page, setPage] = useState(1);
  const [ecosystemCode, setEcosystemCode] = useState<EcosystemCode | ''>('');

  const { data, error, isLoading, refetch } = useApiQuery(
    () => observationsApi.list({ page, pageSize: PAGE_SIZE, ecosystemCode: ecosystemCode || undefined }),
    [page, ecosystemCode]
  );

  return (
    <div>
      <PageHeader
        title="Observations"
        description="Field submissions captured across all ecosystems."
        actions={
          <Link href="/observations/new">
            <Button>New Observation</Button>
          </Link>
        }
      />

      <div className="px-8 py-6">
        <div className="mb-4 flex items-center gap-3">
          <Select
            className="w-48"
            value={ecosystemCode}
            onChange={(e) => {
              setPage(1);
              setEcosystemCode(e.target.value as EcosystemCode | '');
            }}
          >
            <option value="">All ecosystems</option>
            {Object.entries(ECOSYSTEM_LABELS).map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </Select>
        </div>

        {isLoading && <PageLoading label="Loading observations…" />}
        {error && <ErrorState message={error} onRetry={refetch} />}

        {data && data.observations.length === 0 && (
          <EmptyState
            title="No observations yet"
            message="Submissions you capture in the field will appear here."
            action={
              <Link href="/observations/new">
                <Button>New Observation</Button>
              </Link>
            }
          />
        )}

        {data && data.observations.length > 0 && (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border-subtle bg-surface-sunken text-xs font-medium uppercase tracking-wide text-ink-faint">
                  <tr>
                    <th className="px-5 py-3">Ecosystem</th>
                    <th className="px-5 py-3">Location</th>
                    <th className="px-5 py-3">Area</th>
                    <th className="px-5 py-3">Captured</th>
                    <th className="px-5 py-3">Submitted</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {data.observations.map((obs) => (
                    <tr key={obs.id} className="hover:bg-surface-sunken">
                      <td className="px-5 py-3">
                        <Link href={`/observations/${obs.id}`} className="font-medium text-ink hover:text-brand-600">
                          {ECOSYSTEM_LABELS[obs.ecosystem_code]}
                        </Link>
                      </td>
                      <td className="px-5 py-3 font-mono text-xs text-ink-muted">
                        {obs.latitude.toFixed(4)}, {obs.longitude.toFixed(4)}
                      </td>
                      <td className="px-5 py-3 text-ink-muted">{formatNumber(obs.reported_area_m2)} m²</td>
                      <td className="px-5 py-3 text-ink-muted">{formatDateTime(obs.captured_at)}</td>
                      <td className="px-5 py-3 text-ink-muted">{formatDateTime(obs.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {data && (data.observations.length === PAGE_SIZE || page > 1) && (
          <div className="mt-4 flex items-center justify-between">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <span className="text-xs text-ink-faint">Page {page}</span>
            <Button
              variant="outline"
              size="sm"
              disabled={data.observations.length < PAGE_SIZE}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
