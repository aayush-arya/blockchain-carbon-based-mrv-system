'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { analyticsApi } from '@/lib/endpoints';
import { useApiQuery } from '@/lib/useApiQuery';
import { formatCarbon, formatNumber, formatRelativeTime, truncateHash, ECOSYSTEM_LABELS } from '@/lib/utils';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { StatCard } from '@/components/dashboard/StatCard';
import { EcosystemDistributionChart } from '@/components/dashboard/EcosystemDistributionChart';
import { ConfidenceHistogram } from '@/components/dashboard/ConfidenceHistogram';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Badge } from '@/components/ui/Badge';
import { ErrorState, PageLoading, EmptyState } from '@/components/ui/Feedback';
import { Button } from '@/components/ui/Button';

export default function DashboardPage() {
  const { user } = useAuth();
  const { data, error, isLoading, refetch } = useApiQuery(() => analyticsApi.dashboard());

  return (
    <div>
      <PageHeader
        title={`Welcome back, ${user?.fullName.split(' ')[0]}`}
        description="Real-time overview of field submissions, validation, and the blockchain registry."
        actions={
          user?.role !== 'validator' && (
            <Link href="/observations/new">
              <Button>New Observation</Button>
            </Link>
          )
        }
      />

      <div className="px-8 py-6">
        {isLoading && <PageLoading label="Loading dashboard…" />}
        {error && <ErrorState message={error} onRetry={refetch} />}

        {data && (
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Total Observations" value={formatNumber(data.totalObservations)} />
              <StatCard label="Pending Validation" value={formatNumber(data.pendingValidation)} />
              <StatCard
                label="Verified + Tokenized"
                value={formatNumber(data.verifiedMrvRecords + data.tokenizedRecords)}
                sublabel={`${data.tokenizedRecords} tokenized on-chain`}
              />
              <StatCard
                label="Estimated Carbon"
                value={formatCarbon(data.estimatedCarbonTotal)}
                sublabel="Verified + tokenized records"
                tone="brand"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <Card className="lg:col-span-1">
                <CardHeader>
                  <CardTitle>Ecosystem Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <EcosystemDistributionChart data={data.ecosystemDistribution} />
                </CardContent>
              </Card>

              <Card className="lg:col-span-1">
                <CardHeader>
                  <CardTitle>AI Confidence Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <ConfidenceHistogram data={data.aiConfidenceDistribution} />
                </CardContent>
              </Card>

              <Card className="lg:col-span-1">
                <CardHeader>
                  <CardTitle>Validation Success Rate</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col items-center justify-center py-6">
                  {data.validationSuccessRate === null ? (
                    <p className="text-sm text-ink-faint">No validation decisions yet.</p>
                  ) : (
                    <>
                      <p className="font-display text-4xl font-semibold text-ink">
                        {Math.round(data.validationSuccessRate * 100)}%
                      </p>
                      <p className="mt-2 text-xs text-ink-faint">
                        of {data.verifiedMrvRecords + data.tokenizedRecords + data.rejectedRecords} decided records
                        approved
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Recent Submissions</CardTitle>
                  <Link href="/observations" className="text-xs font-medium text-brand-600 hover:underline">
                    View all
                  </Link>
                </CardHeader>
                <CardContent className="p-0">
                  {data.recentMrvRecords.length === 0 ? (
                    <EmptyState title="No MRV records yet" message="Submissions will appear here." />
                  ) : (
                    <ul className="divide-y divide-border-subtle">
                      {data.recentMrvRecords.map((record) => (
                        <li key={record.id}>
                          <Link
                            href={`/mrv/${record.id}`}
                            className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-surface-sunken"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-ink">{record.mrv_code}</p>
                              <p className="text-xs text-ink-faint">
                                {ECOSYSTEM_LABELS[record.ecosystem_code]} &middot;{' '}
                                {formatRelativeTime(record.created_at)}
                              </p>
                            </div>
                            <StatusBadge status={record.status} />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Recent Blockchain Transactions</CardTitle>
                  <Link href="/blockchain" className="text-xs font-medium text-brand-600 hover:underline">
                    View explorer
                  </Link>
                </CardHeader>
                <CardContent className="p-0">
                  {data.recentBlockchainTransactions.length === 0 ? (
                    <EmptyState
                      title="No blockchain transactions yet"
                      message="Transactions appear once records reach validation."
                    />
                  ) : (
                    <ul className="divide-y divide-border-subtle">
                      {data.recentBlockchainTransactions.map((tx) => (
                        <li key={tx.id}>
                          <Link
                            href={`/blockchain/${tx.fabric_tx_id}`}
                            className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-surface-sunken"
                          >
                            <div className="min-w-0">
                              <p className="truncate font-mono text-sm text-ink">{truncateHash(tx.fabric_tx_id)}</p>
                              <p className="text-xs text-ink-faint">
                                {tx.mrv_code} &middot; {formatRelativeTime(tx.created_at)}
                              </p>
                            </div>
                            <Badge tone="info">{tx.chaincode_function}</Badge>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
