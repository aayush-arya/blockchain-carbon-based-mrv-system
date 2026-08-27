import { cn } from '@/lib/utils';

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={cn('h-7 w-7', className)} aria-hidden>
      <rect width="32" height="32" rx="8" className="fill-brand-600" />
      <path
        d="M9 20.5c1.5-4 4-6.5 7-9.5m0 0c1.8 0 3.6.4 5 1.5m-5-1.5c-.5 2 .2 4 1.5 6"
        stroke="white"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <circle cx="10.5" cy="21" r="1.6" className="fill-white" />
    </svg>
  );
}

export function Logo({ className, wordmarkClassName }: { className?: string; wordmarkClassName?: string }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <LogoMark />
      <span className={cn('font-display text-[15px] font-semibold tracking-tight text-ink', wordmarkClassName)}>
        Blue Carbon <span className="text-ink-faint font-normal">Registry</span>
      </span>
    </div>
  );
}
