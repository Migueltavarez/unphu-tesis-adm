'use client';
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ArrowDown, ArrowUp, Flag, Info, Plus, Trash2 } from 'lucide-react';
import { careersApi, milestonesApi } from '@/lib/api';
import { STATUS_LABELS, cn } from '@/lib/utils';
import { MilestonePlan, MilestoneTemplate, ThesisStatus } from '@/types';

// Etapas que pueden cumplir un hito automáticamente (mismo orden que el flujo).
const MILESTONE_STATUSES: ThesisStatus[] = [
  'PROPOSAL_APPROVED', 'REGISTERED', 'PAYMENT_CONFIRMED', 'FACULTY_MEETING', 'DRAFT_APPROVED',
  'ADVISOR_ASSIGNED', 'WORK_STARTED', 'WORK_COMPLETED', 'PRESENTATION_SCHEDULED',
  'PRESENTATION_DONE', 'GRADED', 'APPROVED', 'PUBLISHED',
];

type Row = MilestoneTemplate & { key: string };
let keySeq = 0;
const toRows = (plan: MilestonePlan): Row[] =>
  plan.milestones.map((m) => ({
    key: m.id,
    id: m.id,
    name: m.name,
    description: m.description ?? '',
    daysFromStart: m.daysFromStart,
    required: m.required,
    completesAtStatus: m.completesAtStatus,
  }));

/** "día 120 · ≈ mes 4" */
const monthHint = (days: number) => (days < 30 ? 'primer mes' : `≈ mes ${Math.round(days / 30.4)}`);

export default function MilestonePlanPage() {
  const qc = useQueryClient();
  const { data: careers = [] } = useQuery<any[]>({ queryKey: ['careers'], queryFn: careersApi.list });
  const [careerId, setCareerId] = useState('');
  useEffect(() => {
    if (!careerId && careers.length) setCareerId(careers[0].id);
  }, [careers, careerId]);

  const { data: plan, isLoading } = useQuery<MilestonePlan>({
    queryKey: ['milestone-plan', careerId],
    queryFn: () => milestonesApi.plan(careerId),
    enabled: !!careerId,
  });

  const [rows, setRows] = useState<Row[]>([]);
  const [expected, setExpected] = useState(12);
  const [max, setMax] = useState(24);

  const reset = (p: MilestonePlan) => {
    setRows(toRows(p));
    setExpected(p.career.expectedMonths);
    setMax(p.career.maxMonths);
  };
  useEffect(() => {
    if (plan) reset(plan);
  }, [plan]);

  const dirty = useMemo(() => {
    if (!plan) return false;
    const strip = (r: Row[]) => JSON.stringify(r.map(({ key, ...rest }) => ({ ...rest, description: rest.description || '' })));
    return (
      expected !== plan.career.expectedMonths ||
      max !== plan.career.maxMonths ||
      strip(rows) !== strip(toRows(plan))
    );
  }, [plan, rows, expected, max]);

  // Validación en vivo (la misma que aplica el servidor).
  const problem = useMemo(() => {
    if (max < expected) return 'La duración máxima no puede ser menor que la esperada.';
    if (rows.length === 0) return 'El plan debe tener al menos un hito.';
    if (rows.some((r) => r.name.trim().length < 2)) return 'Cada hito necesita un nombre.';
    for (let i = 1; i < rows.length; i++) {
      if (rows[i].daysFromStart < rows[i - 1].daysFromStart)
        return `"${rows[i].name || 'Hito ' + (i + 1)}" vence antes que el hito anterior. Ordénalos por fecha.`;
    }
    const linked = rows.filter((r) => r.completesAtStatus).map((r) => MILESTONE_STATUSES.indexOf(r.completesAtStatus!));
    if (linked.some((v, i) => i > 0 && v <= linked[i - 1]))
      return 'Las etapas que cumplen los hitos deben seguir el orden del proceso, sin repetirse.';
    return null;
  }, [rows, expected, max]);

  const save = useMutation({
    mutationFn: () =>
      milestonesApi.updatePlan(careerId, {
        expectedMonths: expected,
        maxMonths: max,
        milestones: rows.map(({ key, ...r }) => ({
          ...r,
          name: r.name.trim(),
          description: r.description?.trim() || undefined,
        })),
      }),
    onSuccess: (p: MilestonePlan) => {
      toast.success('Plan de hitos guardado');
      qc.setQueryData(['milestone-plan', careerId], p);
      reset(p);
      qc.invalidateQueries({ queryKey: ['risk-summary'] });
    },
    onError: (e: any) => {
      const msg = e?.response?.data?.message;
      toast.error(Array.isArray(msg) ? msg[0] : msg ?? 'No se pudo guardar el plan');
    },
  });

  const update = (key: string, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const move = (i: number, dir: -1 | 1) =>
    setRows((rs) => {
      const next = [...rs];
      [next[i], next[i + dir]] = [next[i + dir], next[i]];
      return next;
    });
  const add = () =>
    setRows((rs) => [
      ...rs,
      {
        key: `new-${++keySeq}`,
        name: '',
        description: '',
        daysFromStart: (rs[rs.length - 1]?.daysFromStart ?? 0) + 30,
        required: true,
        completesAtStatus: null,
      },
    ]);

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-24">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Plan de hitos</h1>
        <p className="text-sm text-gray-500 mt-1 max-w-2xl">
          Fechas meta de cada programa, contadas desde que el estudiante postula. El semáforo de seguimiento avisa cuando
          un hito está por vencer (7 días) o vencido.
        </p>
      </div>

      <div className="card p-5 flex flex-col sm:flex-row sm:items-end gap-4">
        <div className="flex-1">
          <label className="label" htmlFor="career">Programa</label>
          <select id="career" className="input" value={careerId} onChange={(e) => setCareerId(e.target.value)}>
            {careers.map((c: any) => (
              <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:w-80">
          <div>
            <label className="label" htmlFor="expected">Duración esperada</label>
            <div className="relative">
              <input id="expected" type="number" min={1} max={120} className="input pr-14" value={expected}
                onChange={(e) => setExpected(Number(e.target.value))} />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">meses</span>
            </div>
          </div>
          <div>
            <label className="label" htmlFor="max">Duración máxima</label>
            <div className="relative">
              <input id="max" type="number" min={1} max={120} className="input pr-14" value={max}
                onChange={(e) => setMax(Number(e.target.value))} />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">meses</span>
            </div>
          </div>
        </div>
      </div>
      <p className="text-xs text-gray-500 -mt-3 px-1">
        Al superar la duración esperada la tesis pasa a <span className="font-medium text-red-600">En riesgo</span>;
        al superar la máxima, a <span className="font-medium text-gray-900">Vencida</span>.
      </p>

      <div className="card">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <Flag className="w-4 h-4 text-unphu-600" /> Hitos
            {rows.length > 0 && <span className="text-xs font-normal text-gray-400">{rows.length}</span>}
          </h2>
          <button type="button" onClick={add} className="btn-secondary text-sm inline-flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> Agregar hito
          </button>
        </div>

        {isLoading ? (
          <div className="p-5 space-y-3">
            {[0, 1, 2].map((i) => <div key={i} className="h-16 rounded-lg bg-gray-50 animate-pulse" />)}
          </div>
        ) : (
          <ol className="divide-y divide-gray-100">
            {rows.map((r, i) => (
              <li key={r.key} className="p-4 sm:px-5 flex gap-3">
                <span className="w-6 h-6 mt-1.5 rounded-full bg-unphu-50 text-unphu-700 text-xs font-semibold flex items-center justify-center flex-shrink-0 tabular-nums">
                  {i + 1}
                </span>

                <div className="flex-1 min-w-0 grid gap-2.5 sm:grid-cols-[1fr_9rem] items-start">
                  <div className="space-y-2">
                    <input
                      className="input font-medium"
                      placeholder="Nombre del hito"
                      aria-label={`Nombre del hito ${i + 1}`}
                      value={r.name}
                      onChange={(e) => update(r.key, { name: e.target.value })}
                    />
                    <select
                      className="input text-sm"
                      aria-label={`Cómo se cumple el hito ${i + 1}`}
                      value={r.completesAtStatus ?? ''}
                      onChange={(e) => update(r.key, { completesAtStatus: (e.target.value || null) as ThesisStatus | null })}
                    >
                      <option value="">Manual: lo marca el asesor</option>
                      <optgroup label="Automático: al llegar a la etapa">
                        {MILESTONE_STATUSES.map((s) => (
                          <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                        ))}
                      </optgroup>
                    </select>
                  </div>

                  <div className="flex sm:flex-col gap-2.5 items-center sm:items-stretch">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">Día</span>
                      <input
                        type="number"
                        min={0}
                        max={3650}
                        className="input pl-10 tabular-nums"
                        aria-label={`Día de vencimiento del hito ${i + 1}`}
                        value={r.daysFromStart}
                        onChange={(e) => update(r.key, { daysFromStart: Number(e.target.value) })}
                      />
                    </div>
                    <label className="flex items-center gap-2 text-xs text-gray-600 whitespace-nowrap cursor-pointer">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300 text-unphu-600 focus:ring-unphu-500"
                        checked={r.required}
                        onChange={(e) => update(r.key, { required: e.target.checked })}
                      />
                      Obligatorio
                    </label>
                  </div>
                  <p className="text-[11px] text-gray-400 sm:col-span-2 -mt-1">{monthHint(r.daysFromStart)}</p>
                </div>

                <div className="flex flex-col gap-1 flex-shrink-0">
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0}
                    className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent"
                    aria-label={`Subir hito ${i + 1}`}>
                    <ArrowUp className="w-4 h-4" />
                  </button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === rows.length - 1}
                    className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent"
                    aria-label={`Bajar hito ${i + 1}`}>
                    <ArrowDown className="w-4 h-4" />
                  </button>
                  <button type="button" onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
                    className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50"
                    aria-label={`Eliminar hito ${i + 1}`}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>

      {plan && (
        <p className="text-xs text-gray-500 flex items-start gap-2 px-1">
          <Info className="w-4 h-4 text-gray-400 flex-shrink-0" />
          Los cambios aplican a los trabajos que se inicien desde ahora.
          {plan.activeWorks > 0 &&
            ` Los ${plan.activeWorks} trabajo${plan.activeWorks === 1 ? '' : 's'} en curso de ${plan.career.code} conservan su plan; la duración sí se aplica a todos.`}
        </p>
      )}

      {/* Barra de guardado */}
      <div
        className={cn(
          'fixed bottom-0 inset-x-0 md:left-64 z-20 border-t border-gray-200 bg-white/95 backdrop-blur px-4 py-3 transition-transform',
          dirty ? 'translate-y-0' : 'translate-y-full',
        )}
        aria-hidden={!dirty}
      >
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
          <p className={cn('text-sm flex-1', problem ? 'text-red-600' : 'text-gray-600')}>
            {problem ?? 'Tienes cambios sin guardar.'}
          </p>
          <div className="flex gap-2">
            <button type="button" className="btn-secondary text-sm" onClick={() => plan && reset(plan)}>
              Descartar
            </button>
            <button type="button" className="btn-primary text-sm" disabled={!!problem || save.isPending}
              onClick={() => save.mutate()}>
              {save.isPending ? 'Guardando…' : 'Guardar plan'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
