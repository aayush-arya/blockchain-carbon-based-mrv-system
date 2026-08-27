import { clsx, type ClassValue } from 'clsx';
import type { EcosystemCode, MrvStatus } from './types';

export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffSec = Math.round(diffMs / 1000);
  const diffMin = Math.round(diffSec / 60);
  const diffHour = Math.round(diffMin / 60);
  const diffDay = Math.round(diffHour / 24);
  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 30) return `${diffDay}d ago`;
  return formatDate(iso);
}

export function formatNumber(value: number | string, options?: Intl.NumberFormatOptions): string {
  const n = typeof value === 'string' ? Number(value) : value;
  if (Number.isNaN(n)) return '—';
  return new Intl.NumberFormat(undefined, options).format(n);
}

export function formatCarbon(value: number | string | null): string {
  if (value === null) return '—';
  return `${formatNumber(value, { maximumFractionDigits: 4 })} tCO₂e`;
}

export function truncateHash(hash: string, prefix = 8, suffix = 6): string {
  if (hash.length <= prefix + suffix + 3) return hash;
  return `${hash.slice(0, prefix)}...${hash.slice(-suffix)}`;
}

export const ECOSYSTEM_LABELS: Record<EcosystemCode, string> = {
  mangrove: 'Mangrove',
  seagrass: 'Seagrass',
  salt_marsh: 'Salt Marsh',
};

export const MRV_STATUS_LABELS: Record<MrvStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  ai_analyzed: 'AI Analyzed',
  pending_validation: 'Pending Validation',
  verified: 'Verified',
  tokenized: 'Tokenized',
  rejected: 'Rejected',
};

export type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export const MRV_STATUS_TONE: Record<MrvStatus, StatusTone> = {
  draft: 'neutral',
  submitted: 'info',
  ai_analyzed: 'info',
  pending_validation: 'warning',
  verified: 'success',
  tokenized: 'success',
  rejected: 'danger',
};
