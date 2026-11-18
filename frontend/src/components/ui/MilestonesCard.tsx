'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Check, Flag, RotateCcw } from 'lucide-react';
import { milestonesApi } from '@/lib/api';
import { STATUS_LABELS, cn, formatDate } from '@/lib/utils';
import { MilestoneState, WorkMilestone, WorkMilestones } from '@/types';

const STATE: Record<MilestoneState, { label: string; chip: string; dot: string }> = {
  DONE:     { label: 'Cumplido',   chip: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500 border-emerald-500' },
  OVERDUE:  { label: 'Vencido',    chip: 'bg-red-50 text-red-700',         dot: 'bg-white border-red-500' },
  DUE_SOON: { label: 'Por vencer', chip: 'bg-amber-50 text-amber-800',     dot: 'bg-white border-amber-400' },
  PENDING:  { label: 'Pendiente',  chip: 'bg-gray-100 text-gray-600',      dot: 'bg-white border-gray-300' },
};

function dueText(m: WorkMilestone) {
  if (m.state === 'DONE') {
    if (m.implicit) return 'Cumplido al avanzar el proceso';
    return m.completedAt ? `Cumplido el ${formatDate(m.completedAt)}` : 'Cumplido';
  }
  const d = m.daysToDue;
  if (m.state === 'OVERDUE') return d === 0 ? 'Venció hoy' : `Venció hace ${-d} ${d === -1 ? 'día' : 'días'}`;
  if (m.state === 'DUE_SOON') return d <= 0 ? 'Vence hoy' : `Vence en ${d} ${d === 1 ? 'día' : 'días'}`;
  return `Vence el ${formatDate(m.dueDate)}`;
}

export default function MilestonesCard({ workId }: { workId: string }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<WorkMilestones>({
    queryKey: ['milestones', workId],
    queryFn: () => milestonesApi.forWork(workId),
    enabled: !!workId,
  });

  const mutation = useMutation({
    mutationFn: ({ id, done }: { id: string; done: boolean }) =>
      done ? milestonesApi.complete(id) : milestonesApi.reopen(id),
    onSuccess: (_r, { done }) => {
      toast.success(done ? 'Hito marcado como cumplido' : 'Hito reabierto');
      qc.invalidateQueries({ queryKey: ['milestones', workId] });
      qc.invalidateQueries({ queryKey: ['risk-summary'] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'No se pudo actualizar el hito'),
  });

  if (isLoading || !data) {
    return (
      <div className="card p-5">
        <h3 className="font-semibold text-gray-900 text-sm">Plan de hitos</h3>
        <div className="h-24 mt-4 rounded-lg bg-gray-50 animate-pulse" />
      </div>
    );
  }

  const pct = data.total ? Math.round((data.done / data.total) * 100) : 0;

  return (
    <div className="card p-5">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
          <Flag className="w-4 h-4 text-unphu-600" /> Plan de hitos
        </h3>
        <span className="text-xs text-gray-500 tabular-nums">
          {data.done} de {data.total} cumplidos
        </span>
      </div>
      {!!data.extensionDays && (
        <p className="text-[11px] text-emerald-700 mt-1">Fechas ajustadas por {data.extensionDays} días de prórroga.</p>
      )}
      <div className="mt-2 h-1.5 rounded-full bg-gray-100 overflow-hidden" aria-hidden>
        <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>

      <ol className="mt-4 relative">
        {data.milestones.map((m, i) => {
          const s = STATE[m.state];
          const last = i === data.milestones.length - 1;
          return (
            <li key={m.id} className="relative pl-6 pb-4 last:pb-0">
              {!last && <span className="absolute left-[5px] top-3 bottom-0 w-px bg-gray-200" aria-hidden />}
              <span className={cn('absolute left-0 top-1 w-[11px] h-[11px] rounded-full border-2', s.dot)} aria-hidden>
                {m.state === 'DONE' && <Check className="w-2 h-2 text-white -mt-px -ml-px" strokeWidth={4} />}
              </span>

              <div className="flex items-start justify-between gap-2">
                <p className={cn('text-sm leading-snug', m.state === 'DONE' ? 'text-gray-500' : 'text-gray-900 font-medium')}>
                  {m.name}
                  {!m.required && <span className="text-xs font-normal text-gray-400"> · opcional</span>}
                </p>
                {m.state !== 'DONE' && m.state !== 'PENDING' && (
                  <span className={cn('text-[11px] font-medium rounded-full px-2 py-0.5 whitespace-nowrap', s.chip)}>
                    {s.label}
                  </span>
                )}
              </div>
              <p className={cn('text-xs mt-0.5', m.state === 'OVERDUE' ? 'text-red-600' : 'text-gray-500')}>
                {dueText(m)}
              </p>
              {m.state !== 'DONE' && (
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {m.auto && m.completesAtStatus
                    ? `Se cumple al llegar a: ${STATUS_LABELS[m.completesAtStatus]}`
                    : 'Lo marca el asesor al aprobarlo'}
                </p>
              )}

              {(m.canComplete || m.canReopen) && (
                <button
                  type="button"
                  disabled={mutation.isPending}
                  onClick={() => mutation.mutate({ id: m.id, done: m.canComplete })}
                  className={cn(
                    'mt-1.5 inline-flex items-center gap-1 text-xs font-medium rounded-md px-2 py-1 transition-colors disabled:opacity-50',
                    m.canComplete
                      ? 'text-unphu-700 bg-unphu-50 hover:bg-unphu-100'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100',
                  )}
                >
                  {m.canComplete ? <><Check className="w-3 h-3" /> Marcar cumplido</> : <><RotateCcw className="w-3 h-3" /> Reabrir</>}
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
