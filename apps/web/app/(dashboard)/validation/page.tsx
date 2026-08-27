'use client';

import Link from 'next/link';
import { mrvApi } from '@/lib/endpoints';
import { useApiQuery } from '@/lib/useApiQuery';
import { ECOSYSTEM_LABELS, formatCarbon, formatRelativeTime } from '@/lib/utils';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { Card } from '@/components/ui/Card';
import { ErrorState, PageLoading, EmptyState } from '@/components/ui/Feedback';

export default function ValidationQueuePage() {
  const { data, error, isLoading, refetch } = useApiQuery(() => mrvApi.list({ status: 'pending_validation', pageSize: 50 }));

  return (
    <div>
      <PageHeader title="Validation Queue" description="MRV records awaiting review before they can be tokenized." />

      <div className="px-8 py-6">
        {isLoading && <PageLoading label="Loading queue…" />}
        {error && <ErrorState message={error} onRetry={refetch} />}

        {data && data.mrvRecords.length === 0 && (
          <EmptyState title="Queue is empty" message="Nothing is currently awaiting validation." />
        )}

        {data && data.mrvRecords.length > 0 && (
          <div className="flex flex-col gap-3">
            {data.mrvRecords.map((record) => (
              <Link key={record.id} href={`/mrv/${record.id}`}>
                <Card className="flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:border-brand-400">
                  <div className="min-w-0">
                    <p className="font-mono text-sm font-medium text-ink">{record.mrv_code}</p>
                    <p className="mt-0.5 text-xs text-ink-faint">
                      {ECOSYSTEM_LABELS[record.ecosystem_code]} &middot; submitted {formatRelativeTime(record.created_at)}
                    </p>
                  </div>
                  <p className="whitespace-nowrap text-sm font-medium text-ink">
                    {formatCarbon(record.estimated_carbon_tco2e)}
                  </p>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
