import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, id, ...props }, ref) => {
    const inputId = id ?? props.name;
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-ink">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            'h-10 rounded border border-border bg-surface-raised px-3 text-sm text-ink placeholder:text-ink-faint',
            'focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-brand-400',
            'disabled:cursor-not-allowed disabled:opacity-50',
            error && 'border-status-danger focus:ring-status-danger focus:border-status-danger',
            className
          )}
          {...props}
        />
        {error ? (
          <p className="text-xs text-status-danger">{error}</p>
        ) : hint ? (
          <p className="text-xs text-ink-faint">{hint}</p>
        ) : null}
      </div>
    );
  }
);
Input.displayName = 'Input';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, id, ...props }, ref) => {
    const inputId = id ?? props.name;
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-ink">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={inputId}
          className={cn(
            'rounded border border-border bg-surface-raised px-3 py-2 text-sm text-ink placeholder:text-ink-faint',
            'focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-brand-400',
            'disabled:cursor-not-allowed disabled:opacity-50',
            error && 'border-status-danger focus:ring-status-danger focus:border-status-danger',
            className
          )}
          {...props}
        />
        {error && <p className="text-xs text-status-danger">{error}</p>}
      </div>
    );
  }
);
Textarea.displayName = 'Textarea';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, id, children, ...props }, ref) => {
    const inputId = id ?? props.name;
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-ink">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={inputId}
          className={cn(
            'h-10 rounded border border-border bg-surface-raised px-3 text-sm text-ink',
            'focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-brand-400',
            'disabled:cursor-not-allowed disabled:opacity-50',
            error && 'border-status-danger',
            className
          )}
          {...props}
        >
          {children}
        </select>
        {error && <p className="text-xs text-status-danger">{error}</p>}
      </div>
    );
  }
);
Select.displayName = 'Select';
