import { ThesisStatus } from '@/types';
import { STATUS_LABELS, STATUS_STEP } from '@/lib/utils';
import { CheckCircle, Circle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const STEPS: ThesisStatus[] = [
  'POSTULATION', 'ACADEMIC_VALIDATION', 'PROPOSAL_FORM',
  'PENDING_PAYMENT', 'PAYMENT_CONFIRMED', 'FACULTY_MEETING',
  'DRAFT_IN_PROGRESS', 'DRAFT_APPROVED', 'ADVISOR_ASSIGNED',
  'IN_DEVELOPMENT', 'WORK_COMPLETED', 'PRESENTATION_SCHEDULED',
  'PRESENTATION_DONE', 'APPROVED', 'PUBLISHED',
];

interface Props {
  currentStatus: ThesisStatus;
  compact?: boolean;
}

export default function ProcessTimeline({ currentStatus, compact = false }: Props) {
  const currentStep = STATUS_STEP[currentStatus];
  const isRejected = currentStatus === 'REJECTED';

  if (compact) {
    const progressPct = isRejected ? 0 : Math.round((currentStep / 20) * 100);
    return (
      <div>
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Progreso del proceso</span>
          <span>{progressPct}%</span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all', isRejected ? 'bg-red-500' : 'bg-unphu-600')}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {STEPS.map((step) => {
        const stepNum = STATUS_STEP[step];
        const isDone = stepNum < currentStep;
        const isCurrent = step === currentStatus;

        return (
          <div key={step} className={cn('flex items-center gap-3 py-1.5 px-3 rounded-lg', isCurrent && 'bg-blue-50')}>
            {isRejected && isCurrent ? (
              <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
            ) : isDone ? (
              <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
            ) : isCurrent ? (
              <Circle className="w-4 h-4 text-blue-600 fill-blue-100 flex-shrink-0" />
            ) : (
              <Circle className="w-4 h-4 text-gray-300 flex-shrink-0" />
            )}
            <span className={cn(
              'text-sm',
              isDone ? 'text-gray-500 line-through' : isCurrent ? 'text-blue-700 font-semibold' : 'text-gray-400',
            )}>
              {STATUS_LABELS[step]}
            </span>
          </div>
        );
      })}
    </div>
  );
}
