import { ECOSYSTEM_LABELS } from '@/lib/utils';
import type { EcosystemCode } from '@/lib/types';

const COLOR_CLASS: Record<EcosystemCode, string> = {
  mangrove: 'bg-chart-mangrove',
  seagrass: 'bg-chart-seagrass',
  salt_marsh: 'bg-chart-saltmarsh',
};

export function EcosystemDistributionChart({
  data,
}: {
  data: { ecosystemCode: EcosystemCode; count: number }[];
}) {
  const order: EcosystemCode[] = ['mangrove', 'seagrass', 'salt_marsh'];
  const byCode = new Map(data.map((d) => [d.ecosystemCode, d.count]));
  const rows = order.map((code) => ({ code, count: byCode.get(code) ?? 0 }));
  const max = Math.max(1, ...rows.map((r) => r.count));
  const total = rows.reduce((sum, r) => sum + r.count, 0);

  if (total === 0) {
    return <p className="py-8 text-center text-sm text-ink-faint">No observations recorded yet.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {rows.map((row) => (
        <div key={row.code} className="flex items-center gap-3">
          <span className="w-20 flex-shrink-0 text-sm text-ink-muted">{ECOSYSTEM_LABELS[row.code]}</span>
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-sunken">
            <div
              className={`h-full rounded-full ${COLOR_CLASS[row.code]}`}
              style={{ width: `${Math.max(3, (row.count / max) * 100)}%` }}
            />
          </div>
          <span className="w-10 flex-shrink-0 text-right text-sm font-medium tabular-nums text-ink">
            {row.count}
          </span>
        </div>
      ))}
    </div>
  );
}
