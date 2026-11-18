import { RiskLevel, ThesisRisk } from '@/types';
import { cn } from '@/lib/utils';

// Semáforo de seguimiento. Lo calcula el servidor; aquí solo se presenta.
export const RISK_META: Record<RiskLevel, { label: string; pill: string; dot: string; tile: string }> = {
  GREEN:  { label: 'Al día',    pill: 'bg-emerald-50 text-emerald-700 ring-emerald-200', dot: 'bg-emerald-500', tile: 'bg-emerald-50 text-emerald-700' },
  YELLOW: { label: 'Atención',  pill: 'bg-amber-50 text-amber-800 ring-amber-200',       dot: 'bg-amber-400',   tile: 'bg-amber-50 text-amber-800' },
  RED:    { label: 'En riesgo', pill: 'bg-red-50 text-red-700 ring-red-200',             dot: 'bg-red-500',     tile: 'bg-red-50 text-red-700' },
  BLACK:  { label: 'Vencida',   pill: 'bg-gray-900 text-white ring-gray-900',            dot: 'bg-white',       tile: 'bg-gray-900 text-white' },
};

export const RISK_ORDER: RiskLevel[] = ['BLACK', 'RED', 'YELLOW', 'GREEN'];

interface Props {
  risk?: ThesisRisk | null;
  /** Muestra el motivo principal junto a la etiqueta. */
  withReason?: boolean;
  className?: string;
}

export default function RiskBadge({ risk, withReason, className }: Props) {
  if (!risk) return null;
  const m = RISK_META[risk.level];
  const reason = risk.reasons[0];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap',
        m.pill,
        className,
      )}
      title={risk.reasons.length ? risk.reasons.join(' · ') : 'Actividad al día'}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', m.dot)} aria-hidden />
      {m.label}
      {withReason && reason && <span className="font-normal opacity-80 truncate">· {reason}</span>}
    </span>
  );
}
