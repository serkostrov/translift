import { CLAIM_STATUS_LABELS, type ClaimStatus } from '@contracts';
import { cn } from '@/shared/lib/utils';
import { Badge } from '@/shared/ui/badge';

const CLS: Record<ClaimStatus, string> = {
  NEW: 'bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200',
  IN_REVIEW: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
  ACCEPTED: 'bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200',
  REJECTED: 'bg-muted text-muted-foreground',
  RESOLVED: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200',
};

export function ClaimStatusBadge({ status }: { status: ClaimStatus }) {
  return (
    <Badge variant="secondary" className={cn('border-0', CLS[status])}>
      {CLAIM_STATUS_LABELS[status]}
    </Badge>
  );
}
