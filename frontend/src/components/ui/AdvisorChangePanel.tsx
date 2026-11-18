'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ArrowRight, History, Repeat } from 'lucide-react';
import { advisorsApi, thesisApi } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { AdvisorChangeEntry } from '@/types';

interface Props {
  workId: string;
  advisor: { id: string; user?: { firstName: string; lastName: string; email?: string } };
  /** Coordinación/Admin pueden cambiarlo; los demás solo ven el historial. */
  canChange: boolean;
  /** Query de la página a refrescar tras el cambio. */
  invalidateKey?: unknown[];
}

const name = (a?: { user: { firstName: string; lastName: string } } | null) =>
  a ? `${a.user.firstName} ${a.user.lastName}` : '—';

export default function AdvisorChangePanel({ workId, advisor, canChange, invalidateKey }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState('');
  const [reason, setReason] = useState('');

  const { data: history = [] } = useQuery<AdvisorChangeEntry[]>({
    queryKey: ['advisor-history', workId],
    queryFn: () => thesisApi.advisorHistory(workId),
  });
  const { data: advisors = [] } = useQuery<any[]>({
    queryKey: ['advisors'],
    queryFn: advisorsApi.list,
    enabled: canChange && open,
  });

  const change = useMutation({
    mutationFn: () => thesisApi.changeAdvisor(workId, target, reason.trim()),
    onSuccess: (h: AdvisorChangeEntry[]) => {
      qc.setQueryData(['advisor-history', workId], h);
      if (invalidateKey) qc.invalidateQueries({ queryKey: invalidateKey });
      qc.invalidateQueries({ queryKey: ['advisors'] });
      toast.success('Asesor cambiado. El nuevo asesor ya tiene todo el historial.');
      setOpen(false);
      setTarget('');
      setReason('');
    },
    onError: (e: any) => {
      const m = e?.response?.data?.message;
      toast.error(Array.isArray(m) ? m[0] : m ?? 'No se pudo cambiar el asesor');
    },
  });

  const changes = history.filter((h) => h.fromAdvisorId);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
        <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
          {advisor.user?.firstName?.[0]}{advisor.user?.lastName?.[0]}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-gray-900 truncate">{advisor.user?.firstName} {advisor.user?.lastName}</p>
          {advisor.user?.email && <p className="text-sm text-gray-500 truncate">{advisor.user.email}</p>}
        </div>
        {canChange && !open && (
          <button type="button" onClick={() => setOpen(true)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-unphu-700 bg-white border border-unphu-200 hover:bg-unphu-50 rounded-md px-2.5 py-1.5 flex-shrink-0">
            <Repeat className="w-3.5 h-3.5" /> Cambiar
          </button>
        )}
      </div>

      {open && (
        <div className="rounded-xl border border-gray-200 p-3 space-y-2.5">
          <div>
            <label className="label" htmlFor="new-advisor">Nuevo asesor</label>
            <select id="new-advisor" className="input text-sm" value={target} onChange={(e) => setTarget(e.target.value)}>
              <option value="">Selecciona…</option>
              {advisors.filter((a) => a.id !== advisor.id && a.user?.isActive !== false).map((a) => {
                const full = (a.activeWorks ?? 0) >= a.maxWorkload;
                return (
                  <option key={a.id} value={a.id} disabled={full}>
                    {a.user?.firstName} {a.user?.lastName} — {a.activeWorks ?? 0}/{a.maxWorkload} trabajos{full ? ' (carga completa)' : ''}
                  </option>
                );
              })}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="change-reason">Motivo</label>
            <input id="change-reason" className="input text-sm" maxLength={500}
              placeholder="Salida de la universidad, año sabático, conflicto de interés…"
              value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <p className="text-[11px] text-gray-500">
            El nuevo asesor hereda avances, retroalimentación, reuniones y prórrogas. El estado del trabajo no cambia.
          </p>
          <div className="flex gap-2">
            <button type="button" className="btn-primary text-sm" disabled={!target || reason.trim().length < 10 || change.isPending}
              onClick={() => change.mutate()}>
              {change.isPending ? 'Cambiando…' : 'Confirmar cambio'}
            </button>
            <button type="button" className="btn-secondary text-sm" onClick={() => setOpen(false)}>Cancelar</button>
          </div>
        </div>
      )}

      {changes.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 flex items-center gap-1.5 mb-1.5">
            <History className="w-3.5 h-3.5" /> Historial de asesores
          </p>
          <ul className="space-y-1.5">
            {changes.map((h) => (
              <li key={h.id} className="text-xs text-gray-600">
                <span className="inline-flex items-center gap-1 font-medium text-gray-800">
                  {name(h.fromAdvisor)} <ArrowRight className="w-3 h-3" /> {name(h.toAdvisor)}
                </span>
                <span className="text-gray-400"> · {formatDate(h.createdAt)}</span>
                <span className="block text-gray-500">{h.reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
