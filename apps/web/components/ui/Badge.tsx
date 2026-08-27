import { cn } from '@/lib/utils';
import type { StatusTone } from '@/lib/utils';

const toneClasses: Record<StatusTone, string> = {
  success: 'bg-status-success-bg text-status-success',
  warning: 'bg-status-warning-bg text-status-warning',
  danger: 'bg-status-danger-bg text-status-danger',
  info: 'bg-status-info-bg text-status-info',
  neutral: 'bg-status-neutral-bg text-status-neutral',
};

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: StatusTone;
  dot?: boolean;
}

export function Badge({ className, tone = 'neutral', dot = true, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
        toneClasses[tone],
        className
      )}
      {...props}
    >
      {dot && <span className={cn('h-1.5 w-1.5 rounded-full bg-current')} />}
      {children}
    </span>
  );
}
