import { Badge } from './Badge';
import { MRV_STATUS_LABELS, MRV_STATUS_TONE } from '@/lib/utils';
import type { MrvStatus } from '@/lib/types';

export function StatusBadge({ status }: { status: MrvStatus }) {
  return <Badge tone={MRV_STATUS_TONE[status]}>{MRV_STATUS_LABELS[status]}</Badge>;
}
