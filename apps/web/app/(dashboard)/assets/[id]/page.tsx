'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { assetsApi } from '@/lib/endpoints';
import { useApiQuery } from '@/lib/useApiQuery';
import { formatCarbon, formatDateTime, truncateHash } from '@/lib/utils';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ErrorState, PageLoading } from '@/components/ui/Feedback';

export default function CarbonAssetPage() {
  const params = useParams<{ id: string }>();
  const { data, error, isLoading, refetch } = useApiQuery(() => assetsApi.get(params.id), [params.id]);

  return (
    <div>
      <PageHeader title="Carbon Asset Certificate" description="On-chain proof of a verified blue carbon credit." />
      <div className="mx-auto max-w-2xl px-8 py-6">
        {isLoading && <PageLoading label="Loading certificate…" />}
        {error && <ErrorState message={error} onRetry={refetch} />}

        {data && (
          <Card className="overflow-hidden border-2 border-brand-200">
            <div className="bg-brand-600 px-6 py-5 text-center text-white">
              <p className="text-xs font-medium uppercase tracking-widest text-brand-100">Verified Blue Carbon Asset</p>
              <p className="mt-2 font-display text-3xl font-semibold tracking-tight">
                {formatCarbon(data.asset.estimated_carbon_tco2e)}
              </p>
              <p className="mt-1 font-mono text-xs text-brand-100">{data.asset.asset_id}</p>
            </div>

            <CardContent className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <Field label="Ecosystem" value={data.asset.ecosystem_name} />
                <Field label="Contributor" value={data.asset.contributor_name} />
                <Field label="MRV code" value={data.asset.mrv_code} mono />
                <Field label="Ledger status" value={data.asset.ledger_status} />
                <Field label="Issued" value={data.asset.committed_at ? formatDateTime(data.asset.committed_at) : 'Pending'} />
                <Field label="Block" value={data.asset.block_number ?? '—'} />
              </div>

              <div className="rounded border border-border bg-surface-sunken p-4">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-faint">Cryptographic proof</p>
                <div className="flex flex-col gap-2 font-mono text-xs text-ink-muted">
                  <div>
                    <span className="text-ink-faint">Evidence hash: </span>
                    <span className="break-all">{data.asset.evidence_hash}</span>
                  </div>
                  <div>
                    <span className="text-ink-faint">Metadata hash: </span>
                    <span className="break-all">{data.asset.metadata_hash}</span>
                  </div>
                  <div>
                    <span className="text-ink-faint">Fabric tx: </span>
                    <span className="break-all">{data.asset.fabric_tx_id}</span>
                  </div>
                </div>
              </div>

              <Link
                href={`/blockchain/${data.asset.fabric_tx_id}`}
                className="flex items-center justify-between rounded border border-border px-3 py-2.5 hover:bg-surface-sunken"
              >
                <span className="text-sm text-ink">View on-chain transaction</span>
                <Badge tone="info">{truncateHash(data.asset.fabric_tx_id)}</Badge>
              </Link>

              <p className="text-center text-xs text-ink-faint">
                Prototype MRV platform — not a legally certified carbon registry.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs text-ink-faint">{label}</p>
      <p className={`mt-0.5 font-medium text-ink ${mono ? 'font-mono text-xs' : 'text-sm'}`}>{value}</p>
    </div>
  );
}
