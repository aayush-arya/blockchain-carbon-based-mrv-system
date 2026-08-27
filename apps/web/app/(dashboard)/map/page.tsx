'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { observationsApi } from '@/lib/endpoints';
import { useApiQuery } from '@/lib/useApiQuery';
import { ECOSYSTEM_LABELS } from '@/lib/utils';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { Select } from '@/components/ui/Input';
import { ErrorState, PageLoading } from '@/components/ui/Feedback';
import type { EcosystemCode } from '@/lib/types';

const MapView = dynamic(() => import('@/components/dashboard/MapView').then((m) => m.MapView), {
  ssr: false,
  loading: () => <PageLoading label="Loading map…" />,
});

const LEGEND: { code: EcosystemCode; varName: string }[] = [
  { code: 'mangrove', varName: '--chart-mangrove' },
  { code: 'seagrass', varName: '--chart-seagrass' },
  { code: 'salt_marsh', varName: '--chart-saltmarsh' },
];

export default function LiveMapPage() {
  const [ecosystemCode, setEcosystemCode] = useState<EcosystemCode | ''>('');
  const { data, error, isLoading, refetch } = useApiQuery(
    () => observationsApi.list({ pageSize: 100, ecosystemCode: ecosystemCode || undefined }),
    [ecosystemCode]
  );

  return (
    <div className="flex h-screen flex-col">
      <PageHeader
        title="Live MRV Map"
        description="Field observations plotted by capture location."
        actions={
          <Select value={ecosystemCode} onChange={(e) => setEcosystemCode(e.target.value as EcosystemCode | '')} className="w-48">
            <option value="">All ecosystems</option>
            {Object.entries(ECOSYSTEM_LABELS).map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </Select>
        }
      />

      <div className="relative flex-1">
        {isLoading && (
          <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-surface/60">
            <PageLoading label="Loading observations…" />
          </div>
        )}
        {error && (
          <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-surface">
            <ErrorState message={error} onRetry={refetch} />
          </div>
        )}
        {data && <MapView observations={data.observations} />}

        <div className="absolute bottom-4 left-4 z-[1000] flex gap-3 rounded-lg border border-border bg-surface-raised/95 px-3 py-2 shadow-card backdrop-blur">
          {LEGEND.map((item) => (
            <div key={item.code} className="flex items-center gap-1.5 text-xs text-ink-muted">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: `hsl(var(${item.varName}))` }}
              />
              {ECOSYSTEM_LABELS[item.code]}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
