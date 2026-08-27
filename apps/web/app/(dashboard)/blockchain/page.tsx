'use client';

import Link from 'next/link';
import { useState } from 'react';
import { blockchainApi } from '@/lib/endpoints';
import { useApiQuery } from '@/lib/useApiQuery';
import { formatDateTime, formatNumber, truncateHash } from '@/lib/utils';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { StatCard } from '@/components/dashboard/StatCard';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/Button';
import { ErrorState, PageLoading, EmptyState } from '@/components/ui/Feedback';

const PAGE_SIZE = 25;

export default function BlockchainExplorerPage() {
  const [page, setPage] = useState(1);
  const stats = useApiQuery(() => blockchainApi.stats());
  const { data, error, isLoading, refetch } = useApiQuery(() => blockchainApi.transactions({ page, pageSize: PAGE_SIZE }), [page]);

  return (
    <div>
      <PageHeader title="Blockchain Explorer" description="Every chaincode transaction recorded on the permissioned Fabric ledger." />

      <div className="px-8 py-6">
        {stats.data && (
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <StatCard label="Total Transactions" value={formatNumber(stats.data.transactionCount)} />
            <StatCard label="Tokenized Assets" value={formatNumber(stats.data.tokenizedAssetCount)} tone="brand" />
          </div>
        )}

        {isLoading && <PageLoading label="Loading transactions…" />}
        {error && <ErrorState message={error} onRetry={refetch} />}

        {data && data.transactions.length === 0 && (
          <EmptyState title="No transactions yet" message="Transactions appear once records reach validation." />
        )}

        {data && data.transactions.length > 0 && (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border-subtle bg-surface-sunken text-xs font-medium uppercase tracking-wide text-ink-faint">
                  <tr>
                    <th className="px-5 py-3">Transaction</th>
                    <th className="px-5 py-3">Function</th>
                    <th className="px-5 py-3">MRV Record</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {data.transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-surface-sunken">
                      <td className="px-5 py-3">
                        <Link href={`/blockchain/${tx.fabric_tx_id}`} className="font-mono text-xs text-brand-600 hover:underline">
                          {truncateHash(tx.fabric_tx_id)}
                        </Link>
                      </td>
                      <td className="px-5 py-3">
                        <Badge tone="info">{tx.chaincode_function}</Badge>
                      </td>
                      <td className="px-5 py-3 font-mono text-xs text-ink-muted">{tx.mrv_code}</td>
                      <td className="px-5 py-3">
                        <StatusBadge status={tx.mrv_status} />
                      </td>
                      <td className="px-5 py-3 text-ink-muted">{formatDateTime(tx.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {data && (data.transactions.length === PAGE_SIZE || page > 1) && (
          <div className="mt-4 flex items-center justify-between">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <span className="text-xs text-ink-faint">Page {page}</span>
            <Button
              variant="outline"
              size="sm"
              disabled={data.transactions.length < PAGE_SIZE}
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
