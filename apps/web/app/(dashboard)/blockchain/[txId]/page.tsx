'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { blockchainApi } from '@/lib/endpoints';
import { useApiQuery } from '@/lib/useApiQuery';
import { ECOSYSTEM_LABELS, formatCarbon, formatDateTime } from '@/lib/utils';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ErrorState, PageLoading } from '@/components/ui/Feedback';

export default function BlockchainTransactionPage() {
  const params = useParams<{ txId: string }>();
  const { data, error, isLoading, refetch } = useApiQuery(() => blockchainApi.transaction(params.txId), [params.txId]);

  return (
    <div>
      <PageHeader title="Transaction" description="Hyperledger Fabric chaincode transaction detail." />
      <div className="mx-auto max-w-2xl px-8 py-6">
        {isLoading && <PageLoading label="Loading transaction…" />}
        {error && <ErrorState message={error} onRetry={refetch} />}

        {data && (
          <Card>
            <CardHeader>
              <CardTitle>{data.transaction.chaincode_function}</CardTitle>
              <StatusBadge status={data.transaction.mrv_status} />
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              <DetailRow label="Transaction ID" value={data.transaction.fabric_tx_id} mono />
              <DetailRow label="Channel" value={data.transaction.channel_name} />
              <DetailRow label="Chaincode" value={data.transaction.chaincode_name} />
              <DetailRow label="Submitted by" value={data.transaction.submitted_by_name ?? 'System'} />
              <DetailRow label="Timestamp" value={formatDateTime(data.transaction.created_at)} />
              <div className="my-2 h-px bg-border-subtle" />
              <DetailRow label="Ecosystem" value={ECOSYSTEM_LABELS[data.transaction.ecosystem_code]} />
              <DetailRow label="Estimated carbon" value={formatCarbon(data.transaction.estimated_carbon_tco2e)} />
              <Link
                href={`/mrv/${data.transaction.mrv_record_id}`}
                className="mt-2 flex items-center justify-between rounded border border-border px-3 py-2.5 hover:bg-surface-sunken"
              >
                <span className="font-mono text-sm text-ink">{data.transaction.mrv_code}</span>
                <Badge tone="info">View record</Badge>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-ink-faint">{label}</span>
      <span className={`text-right font-medium text-ink ${mono ? 'break-all font-mono text-xs' : ''}`}>{value}</span>
    </div>
  );
}
