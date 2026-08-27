import { cn } from '@/lib/utils';

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cn('h-5 w-5 animate-spin text-ink-faint', className)} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

export function PageLoading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 py-24 text-ink-faint">
      <Spinner className="h-6 w-6" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'animate-pulse rounded bg-surface-sunken bg-[length:200%_100%]',
        className
      )}
    />
  );
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border py-16 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-status-danger-bg text-status-danger">
        <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
          <path
            d="M12 9v4m0 4h.01M10.29 3.86l-8.18 14.18A1 1 0 003 19.5h18a1 1 0 00.89-1.46L13.71 3.86a1 1 0 00-1.72 0z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <p className="font-medium text-ink">{title}</p>
      {message && <p className="max-w-sm text-sm text-ink-muted">{message}</p>}
      {onRetry && (
        <button onClick={onRetry} className="mt-2 text-sm font-medium text-brand-600 hover:underline">
          Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  message,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  message?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border py-16 text-center">
      {icon && <div className="mb-1 text-ink-faint">{icon}</div>}
      <p className="font-medium text-ink">{title}</p>
      {message && <p className="max-w-sm text-sm text-ink-muted">{message}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
