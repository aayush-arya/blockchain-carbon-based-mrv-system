import { Card } from '@/components/ui/Card';
import { cn } from '@/lib/utils';

export function StatCard({
  label,
  value,
  sublabel,
  icon,
  tone = 'default',
}: {
  label: string;
  value: string;
  sublabel?: string;
  icon?: React.ReactNode;
  tone?: 'default' | 'brand';
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-ink-muted">{label}</p>
        {icon && (
          <div
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-full',
              tone === 'brand' ? 'bg-brand-100 text-brand-700' : 'bg-surface-sunken text-ink-faint'
            )}
          >
            {icon}
          </div>
        )}
      </div>
      <p className="mt-3 font-display text-[26px] font-semibold leading-none tracking-tight text-ink">{value}</p>
      {sublabel && <p className="mt-2 text-xs text-ink-faint">{sublabel}</p>}
    </Card>
  );
}
