import { ThesisStatus } from '@/types';
import { STATUS_COLORS, STATUS_LABELS } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface Props {
  status: ThesisStatus;
  className?: string;
}

export default function StatusBadge({ status, className }: Props) {
  return (
    <span className={cn('badge', STATUS_COLORS[status], className)}>
      {STATUS_LABELS[status]}
    </span>
  );
}
