'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { ApiError } from '@/lib/api';
import { mrvApi, validationApi } from '@/lib/endpoints';
import { useApiQuery } from '@/lib/useApiQuery';
import { ECOSYSTEM_LABELS, formatCarbon, formatDateTime, formatNumber, truncateHash } from '@/lib/utils';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { EvidenceImage } from '@/components/dashboard/EvidenceImage';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Input';
import { ErrorState, PageLoading } from '@/components/ui/Feedback';

export default function MrvDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { data, error, isLoading, refetch } = useApiQuery(() => mrvApi.get(params.id), [params.id]);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);

  async function runAction(action: () => Promise<unknown>) {
    setBusy(true);
    setActionError(null);
    try {
      await action();
      await refetch();
      setShowRejectForm(false);
      setRejectReason('');
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Action failed. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  if (isLoading) return <PageLoading label="Loading MRV record…" />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (!data) return null;

  const record = data.mrvRecord;
  const isOwner = user?.id === record.observation.contributor_id;
  const canOperate = user?.role === 'admin' || (isOwner && user?.role === 'field_operator');
  const canValidate = user?.role === 'validator' || user?.role === 'admin';

  return (
    <div>
      <PageHeader
        title={record.mrv_code}
        description={`${ECOSYSTEM_LABELS[record.observation.ecosystem_code]} · submitted by ${record.observation.contributor_name}`}
        actions={<StatusBadge status={record.status} />}
      />

      <div className="px-8 py-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="flex flex-col gap-6 lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Evidence</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {record.observation.evidence.map((file) => (
                  <EvidenceImage
                    key={file.id}
                    evidenceFileId={file.id}
                    alt={file.original_filename ?? 'Evidence photo'}
                    className="max-h-[420px] w-full object-contain bg-surface-sunken"
                  />
                ))}
              </CardContent>
            </Card>

            {record.aiAnalysis && (
              <Card>
                <CardHeader>
                  <CardTitle>AI Analysis</CardTitle>
                  <Badge tone="info">{record.aiAnalysis.model_mode}</Badge>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  <Stat label="Predicted ecosystem" value={ECOSYSTEM_LABELS[record.observation.ecosystem_code]} />
                  <Stat label="Confidence" value={`${Math.round(Number(record.aiAnalysis.confidence) * 100)}%`} />
                  <Stat label="Vegetation coverage" value={`${Number(record.aiAnalysis.vegetation_coverage_pct).toFixed(1)}%`} />
                  <Stat label="Model" value={record.aiAnalysis.model_name} />
                  <Stat label="Inference time" value={record.aiAnalysis.inference_ms ? `${record.aiAnalysis.inference_ms} ms` : '—'} />
                  {record.aiAnalysis.warnings.length > 0 && (
                    <div className="col-span-full">
                      {record.aiAnalysis.warnings.map((w, i) => (
                        <p key={i} className="text-xs text-status-warning">
                          ⚠ {w}
                        </p>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {record.calculation_breakdown && (
              <Card>
                <CardHeader>
                  <CardTitle>Carbon Calculation</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                    <Stat label="Effective area" value={`${formatNumber(record.calculation_breakdown.effective_area_m2)} m²`} />
                    <Stat label="Carbon factor" value={`${record.calculation_breakdown.carbon_factor_value} ${record.calculation_breakdown.carbon_factor_unit}`} />
                    <Stat label="Estimated carbon" value={formatCarbon(record.calculation_breakdown.estimated_carbon_tco2e)} />
                  </div>
                  <p className="rounded bg-surface-sunken px-3 py-2 text-xs text-ink-faint">
                    {record.calculation_breakdown.formula}
                  </p>
                  <p className="text-xs text-ink-faint">Source: {record.calculation_breakdown.carbon_factor_source}</p>
                </CardContent>
              </Card>
            )}

            {record.validationEvents.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Validation History</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <ul className="divide-y divide-border-subtle">
                    {record.validationEvents.map((ev) => (
                      <li key={ev.id} className="flex items-start justify-between gap-3 px-5 py-3">
                        <div>
                          <p className="text-sm font-medium capitalize text-ink">{ev.action.replace('_', ' ')}</p>
                          {ev.reason && <p className="mt-0.5 text-xs text-ink-muted">{ev.reason}</p>}
                          <p className="mt-0.5 text-xs text-ink-faint">by {ev.validator_name}</p>
                        </div>
                        <span className="whitespace-nowrap text-xs text-ink-faint">{formatDateTime(ev.created_at)}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="flex flex-col gap-6">
            {(canOperate || canValidate) && (
              <Card>
                <CardHeader>
                  <CardTitle>Actions</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  {actionError && (
                    <p className="rounded border border-status-danger/30 bg-status-danger-bg px-3 py-2 text-xs text-status-danger">
                      {actionError}
                    </p>
                  )}

                  {canOperate && record.status === 'draft' && (
                    <Button loading={busy} onClick={() => runAction(() => mrvApi.submit(record.id))}>
                      Submit for analysis
                    </Button>
                  )}
                  {canOperate && record.status === 'submitted' && (
                    <Button loading={busy} onClick={() => runAction(() => mrvApi.analyze(record.id))}>
                      Run AI analysis
                    </Button>
                  )}
                  {canOperate && record.status === 'ai_analyzed' && (
                    <Button loading={busy} onClick={() => runAction(() => mrvApi.calculate(record.id))}>
                      Calculate carbon estimate
                    </Button>
                  )}
                  {canOperate && record.status === 'pending_validation' && (
                    <p className="text-sm text-ink-faint">Awaiting validator review.</p>
                  )}

                  {canValidate && record.status === 'pending_validation' && !showRejectForm && (
                    <>
                      <Button loading={busy} onClick={() => runAction(() => validationApi.approve(record.id))}>
                        Approve
                      </Button>
                      <Button variant="danger" disabled={busy} onClick={() => setShowRejectForm(true)}>
                        Reject
                      </Button>
                    </>
                  )}
                  {canValidate && record.status === 'pending_validation' && showRejectForm && (
                    <>
                      <Textarea
                        label="Rejection reason"
                        required
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        rows={3}
                      />
                      <div className="flex gap-2">
                        <Button
                          variant="danger"
                          loading={busy}
                          disabled={!rejectReason.trim()}
                          onClick={() => runAction(() => validationApi.reject(record.id, rejectReason))}
                        >
                          Confirm reject
                        </Button>
                        <Button variant="outline" disabled={busy} onClick={() => setShowRejectForm(false)}>
                          Cancel
                        </Button>
                      </div>
                    </>
                  )}
                  {canValidate && record.status === 'verified' && (
                    <Button
                      loading={busy}
                      onClick={() =>
                        runAction(async () => {
                          const result = await mrvApi.tokenize(record.id);
                          router.push(`/mrv/${record.id}`);
                          return result;
                        })
                      }
                    >
                      Issue carbon token
                    </Button>
                  )}
                  {record.status === 'tokenized' && (
                    <p className="text-sm text-status-success">Tokenized — carbon asset issued on-chain.</p>
                  )}
                  {record.status === 'rejected' && record.rejection_reason && (
                    <p className="text-sm text-status-danger">Rejected: {record.rejection_reason}</p>
                  )}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Record</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 text-sm">
                <DetailRow label="MRV code" value={record.mrv_code} />
                <DetailRow label="Ecosystem" value={ECOSYSTEM_LABELS[record.observation.ecosystem_code]} />
                <DetailRow label="Created" value={formatDateTime(record.created_at)} />
                <DetailRow label="Updated" value={formatDateTime(record.updated_at)} />
                <Link href={`/observations/${record.observation.id}`} className="text-xs font-medium text-brand-600 hover:underline">
                  View source observation
                </Link>
              </CardContent>
            </Card>

            {record.blockchainAsset && (
              <Card>
                <CardHeader>
                  <CardTitle>Carbon Asset</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3 text-sm">
                  <DetailRow label="Asset ID" value={record.blockchainAsset.asset_id} />
                  <DetailRow label="Ledger status" value={record.blockchainAsset.ledger_status} />
                  <Link
                    href={`/assets/${record.blockchainAsset.asset_id}`}
                    className="text-xs font-medium text-brand-600 hover:underline"
                  >
                    View certificate
                  </Link>
                </CardContent>
              </Card>
            )}

            {record.blockchainTransactions.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Blockchain Transactions</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <ul className="divide-y divide-border-subtle">
                    {record.blockchainTransactions.map((tx) => (
                      <li key={tx.id}>
                        <Link
                          href={`/blockchain/${tx.fabric_tx_id}`}
                          className="flex items-center justify-between gap-2 px-5 py-3 text-xs hover:bg-surface-sunken"
                        >
                          <span className="font-mono text-ink">{truncateHash(tx.fabric_tx_id)}</span>
                          <Badge tone="info">{tx.chaincode_function}</Badge>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-ink-faint">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-ink">{value}</p>
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
