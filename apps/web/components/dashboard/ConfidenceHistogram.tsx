export function ConfidenceHistogram({ data }: { data: { bucket: number; count: number }[] }) {
  const buckets = Array.from({ length: 10 }, (_, i) => i / 10);
  const byBucket = new Map(data.map((d) => [Math.round(d.bucket * 10) / 10, d.count]));
  const rows = buckets.map((b) => ({ bucket: b, count: byBucket.get(b) ?? 0 }));
  const max = Math.max(1, ...rows.map((r) => r.count));
  const total = rows.reduce((sum, r) => sum + r.count, 0);

  if (total === 0) {
    return <p className="py-8 text-center text-sm text-ink-faint">No AI analyses recorded yet.</p>;
  }

  return (
    <div>
      <div className="flex h-32 items-end gap-1.5">
        {rows.map((row) => (
          <div key={row.bucket} className="group relative flex-1">
            <div
              className="w-full rounded-t bg-brand-500 transition-colors group-hover:bg-brand-600"
              style={{ height: `${Math.max(3, (row.count / max) * 100)}%` }}
            />
            <div className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 rounded bg-ink px-1.5 py-0.5 text-[11px] font-medium text-surface opacity-0 transition-opacity group-hover:opacity-100">
              {row.count}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-1.5">
        {rows.map((row) => (
          <span key={row.bucket} className="flex-1 text-center text-[10px] tabular-nums text-ink-faint">
            .{Math.round(row.bucket * 10)}
          </span>
        ))}
      </div>
      <p className="mt-1 text-center text-xs text-ink-faint">AI confidence score (0.0 – 1.0)</p>
    </div>
  );
}
