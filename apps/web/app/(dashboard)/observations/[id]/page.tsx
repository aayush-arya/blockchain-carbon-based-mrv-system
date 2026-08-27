'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { observationsApi } from '@/lib/endpoints';
import { useApiQuery } from '@/lib/useApiQuery';
import { ECOSYSTEM_LABELS, formatDateTime, formatNumber } from '@/lib/utils';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { EvidenceImage } from '@/components/dashboard/EvidenceImage';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/Button';
import { ErrorState, PageLoading } from '@/components/ui/Feedback';

export default function ObservationDetailPage() {
  const params = useParams<{ id: string }>();
  const { data, error, isLoading, refetch } = useApiQuery(() => observationsApi.get(params.id), [params.id]);

  return (
    <div>
      <PageHeader title="Observation" description={data ? ECOSYSTEM_LABELS[data.observation.ecosystem_code] : undefined} />
      <div className="px-8 py-6">
        {isLoading && <PageLoading label="Loading observation…" />}
        {error && <ErrorState message={error} onRetry={refetch} />}

        {data && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="flex flex-col gap-6 lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>Evidence</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {data.observation.evidence.map((file) => (
                    <EvidenceImage
                      key={file.id}
                      evidenceFileId={file.id}
                      alt={file.original_filename ?? 'Evidence photo'}
                      className="max-h-[480px] w-full object-contain bg-surface-sunken"
                    />
                  ))}
                </CardContent>
              </Card>

              {data.observation.notes && (
                <Card>
                  <CardHeader>
                    <CardTitle>Notes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-ink-muted">{data.observation.notes}</p>
                  </CardContent>
                </Card>
              )}
            </div>

            <div className="flex flex-col gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Details</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3 text-sm">
                  <DetailRow label="Ecosystem" value={ECOSYSTEM_LABELS[data.observation.ecosystem_code]} />
                  <DetailRow
                    label="Location"
                    value={`${data.observation.latitude.toFixed(5)}, ${data.observation.longitude.toFixed(5)}`}
                  />
                  <DetailRow label="Reported area" value={`${formatNumber(data.observation.reported_area_m2)} m²`} />
                  <DetailRow label="Captured" value={formatDateTime(data.observation.captured_at)} />
                  <DetailRow label="Submitted by" value={data.observation.contributor_name} />
                  <DetailRow label="Submitted at" value={formatDateTime(data.observation.created_at)} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>MRV Record</CardTitle>
                </CardHeader>
                <CardContent>
                  {data.observation.mrvRecord ? (
                    <Link
                      href={`/mrv/${data.observation.mrvRecord.id}`}
                      className="flex items-center justify-between gap-2 rounded border border-border px-3 py-2.5 hover:bg-surface-sunken"
                    >
                      <span className="font-mono text-sm text-ink">{data.observation.mrvRecord.mrv_code}</span>
                      <StatusBadge status={data.observation.mrvRecord.status} />
                    </Link>
                  ) : (
                    <p className="text-sm text-ink-faint">
                      No MRV record has been created for this observation yet.
                    </p>
                  )}
                </CardContent>
              </Card>

              <Link href="/observations">
                <Button variant="outline" className="w-full">
                  Back to observations
                </Button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-ink-faint">{label}</span>
      <span className="text-right font-medium text-ink">{value}</span>
    </div>
  );
}
