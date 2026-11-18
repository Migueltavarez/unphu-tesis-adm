'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Check, CheckCircle2, ChevronDown, ListChecks, MapPin, RotateCcw, Trash2 } from 'lucide-react';
import { feedbackApi } from '@/lib/api';
import { CATEGORY, FEEDBACK_STATUS, SEVERITY } from '@/lib/feedback';
import { cn, formatDate } from '@/lib/utils';
import { FeedbackItem, FeedbackList, FeedbackStatus } from '@/types';

interface Props {
  workId: string;
  /** Texto del encabezado según quién lo ve. */
  title?: string;
}

type Pending = { id: string; kind: 'resolve' | 'reopen' } | null;

export default function FeedbackChecklist({ workId, title = 'Retroalimentación' }: Props) {
  const qc = useQueryClient();
  const key = ['feedback', workId];
  const { data, isLoading } = useQuery<FeedbackList>({
    queryKey: key,
    queryFn: () => feedbackApi.list(workId),
    enabled: !!workId,
  });

  const [pending, setPending] = useState<Pending>(null);
  const [note, setNote] = useState('');
  const [showVerified, setShowVerified] = useState(false);

  const act = useMutation({
    mutationFn: ({ id, kind, note }: { id: string; kind: 'resolve' | 'verify' | 'reopen' | 'remove'; note?: string }) => {
      if (kind === 'resolve') return feedbackApi.resolve(id, note);
      if (kind === 'verify') return feedbackApi.verify(id);
      if (kind === 'reopen') return feedbackApi.reopen(id, note);
      return feedbackApi.remove(id);
    },
    onSuccess: (list: FeedbackList, { kind }) => {
      qc.setQueryData(key, list);
      qc.invalidateQueries({ queryKey: ['risk-summary'] });
      setPending(null);
      setNote('');
      toast.success(
        { resolve: 'Marcada como resuelta', verify: 'Corrección verificada', reopen: 'Observación reabierta', remove: 'Observación eliminada' }[kind],
      );
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'No se pudo actualizar la observación'),
  });

  if (isLoading) {
    return (
      <div className="card p-5">
        <h3 className="font-semibold text-gray-900 text-sm">{title}</h3>
        <div className="h-20 mt-4 rounded-lg bg-gray-50 animate-pulse" />
      </div>
    );
  }
  if (!data || data.summary.total === 0) {
    return (
      <div className="card p-5">
        <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
          <ListChecks className="w-4 h-4 text-unphu-600" /> {title}
        </h3>
        <p className="text-sm text-gray-500 mt-3">Aún no hay observaciones del asesor.</p>
      </div>
    );
  }

  const { summary } = data;
  const groups: { status: FeedbackStatus; items: FeedbackItem[] }[] = (['OPEN', 'RESOLVED', 'VERIFIED'] as FeedbackStatus[])
    .map((status) => ({ status, items: data.items.filter((i) => i.status === status) }))
    .filter((g) => g.items.length > 0);
  const pct = Math.round((summary.verified / summary.total) * 100);

  return (
    <div className="card p-5">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
          <ListChecks className="w-4 h-4 text-unphu-600" /> {title}
        </h3>
        <span className="text-xs text-gray-500 tabular-nums">
          {summary.verified} de {summary.total} cerradas
        </span>
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-gray-100 overflow-hidden flex" aria-hidden>
        <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
        <div className="h-full bg-sky-300" style={{ width: `${Math.round((summary.resolved / summary.total) * 100)}%` }} />
      </div>
      {summary.blockingOpen > 0 && (
        <p className="mt-3 text-xs font-medium text-red-700 bg-red-50 rounded-lg px-3 py-2">
          {summary.blockingOpen === 1 ? '1 observación bloqueante impide' : `${summary.blockingOpen} observaciones bloqueantes impiden`} aprobar el próximo avance.
        </p>
      )}

      <div className="mt-4 space-y-5">
        {groups.map((g) => {
          const collapsed = g.status === 'VERIFIED' && !showVerified;
          return (
            <section key={g.status}>
              <button
                type="button"
                disabled={g.status !== 'VERIFIED'}
                onClick={() => setShowVerified((v) => !v)}
                className="w-full flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-2 disabled:cursor-default"
              >
                <span>{FEEDBACK_STATUS[g.status]} · {g.items.length}</span>
                {g.status === 'VERIFIED' && <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', showVerified && 'rotate-180')} />}
              </button>

              {!collapsed && (
                <ul className="space-y-2">
                  {g.items.map((item) => (
                    <li
                      key={item.id}
                      className={cn(
                        'rounded-xl border p-3',
                        item.status === 'VERIFIED' ? 'border-gray-100 bg-gray-50/60' : 'border-gray-200',
                      )}
                    >
                      <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                        <span className={cn('text-[11px] font-medium rounded-full px-2 py-0.5 ring-1 ring-inset', SEVERITY[item.severity].pill)}>
                          {SEVERITY[item.severity].label}
                        </span>
                        <span className="text-[11px] text-gray-500">{CATEGORY[item.category]}</span>
                        {item.advance && <span className="text-[11px] text-gray-400">· Avance v{item.advance.version}</span>}
                        {item.reopenCount > 0 && item.status === 'OPEN' && (
                          <span className="text-[11px] font-medium text-orange-700">· Reabierta</span>
                        )}
                      </div>

                      <p className={cn('text-sm', item.status === 'VERIFIED' ? 'text-gray-500 line-through decoration-gray-300' : 'text-gray-900')}>
                        {item.text}
                      </p>
                      {item.location && (
                        <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {item.location}
                        </p>
                      )}
                      {item.advisorNote && item.status === 'OPEN' && (
                        <p className="text-xs text-orange-800 bg-orange-50 rounded-md px-2 py-1 mt-2">
                          Motivo de reapertura: {item.advisorNote}
                        </p>
                      )}
                      {item.studentNote && item.status !== 'OPEN' && (
                        <p className="text-xs text-sky-900 bg-sky-50 rounded-md px-2 py-1 mt-2">
                          Respuesta del estudiante: {item.studentNote}
                        </p>
                      )}
                      <p className="text-[11px] text-gray-400 mt-1.5">
                        {item.author.firstName} {item.author.lastName} · {formatDate(item.createdAt)}
                        {item.verifiedAt && ` · verificada el ${formatDate(item.verifiedAt)}`}
                      </p>

                      {/* Nota al resolver / reabrir */}
                      {pending?.id === item.id ? (
                        <div className="mt-2 space-y-2">
                          <textarea
                            autoFocus
                            rows={2}
                            className="input text-sm"
                            maxLength={1000}
                            placeholder={pending.kind === 'resolve' ? '¿Qué cambiaste? (opcional)' : '¿Por qué se reabre? (opcional)'}
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                          />
                          <div className="flex gap-2">
                            <button
                              type="button"
                              className="btn-primary text-xs px-3 py-1.5"
                              disabled={act.isPending}
                              onClick={() => act.mutate({ id: item.id, kind: pending.kind, note })}
                            >
                              {pending.kind === 'resolve' ? 'Marcar resuelta' : 'Reabrir'}
                            </button>
                            <button type="button" className="btn-secondary text-xs px-3 py-1.5" onClick={() => { setPending(null); setNote(''); }}>
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        (item.canResolve || item.canVerify || item.canReopen || item.canDelete) && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {item.canResolve && (
                              <button type="button" onClick={() => setPending({ id: item.id, kind: 'resolve' })}
                                className="inline-flex items-center gap-1 text-xs font-medium rounded-md px-2 py-1 text-unphu-700 bg-unphu-50 hover:bg-unphu-100">
                                <Check className="w-3 h-3" /> Ya lo corregí
                              </button>
                            )}
                            {item.canVerify && (
                              <button type="button" disabled={act.isPending} onClick={() => act.mutate({ id: item.id, kind: 'verify' })}
                                className="inline-flex items-center gap-1 text-xs font-medium rounded-md px-2 py-1 text-emerald-700 bg-emerald-50 hover:bg-emerald-100">
                                <CheckCircle2 className="w-3 h-3" /> {item.status === 'OPEN' ? 'Cerrar' : 'Verificar'}
                              </button>
                            )}
                            {item.canReopen && (
                              <button type="button" onClick={() => setPending({ id: item.id, kind: 'reopen' })}
                                className="inline-flex items-center gap-1 text-xs font-medium rounded-md px-2 py-1 text-gray-600 hover:bg-gray-100">
                                <RotateCcw className="w-3 h-3" /> Reabrir
                              </button>
                            )}
                            {item.canDelete && (
                              <button type="button" disabled={act.isPending} onClick={() => act.mutate({ id: item.id, kind: 'remove' })}
                                className="inline-flex items-center gap-1 text-xs font-medium rounded-md px-2 py-1 text-gray-400 hover:text-red-600 hover:bg-red-50"
                                aria-label="Eliminar observación">
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        )
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
