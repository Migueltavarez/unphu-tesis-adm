'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { CheckCircle, Lock, Plus, Send, X } from 'lucide-react';
import { advancesApi, feedbackApi } from '@/lib/api';
import { CATEGORY, SEVERITY, SEVERITY_ORDER } from '@/lib/feedback';
import { cn } from '@/lib/utils';
import { FeedbackCategory, FeedbackItemInput, FeedbackList, FeedbackSeverity } from '@/types';

interface Props {
  workId: string;
  advanceId: string;
  /** Query a refrescar tras revisar (la de la página). */
  invalidateKey: unknown[];
}

const EMPTY = { category: 'CONTENT' as FeedbackCategory, severity: 'MAJOR' as FeedbackSeverity, location: '', text: '' };

/**
 * Revisión de un avance: el asesor arma el checklist de observaciones de esta
 * versión y decide aprobar o solicitar cambios.
 */
export default function AdvanceReviewForm({ workId, advanceId, invalidateKey }: Props) {
  const qc = useQueryClient();
  const [drafts, setDrafts] = useState<FeedbackItemInput[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [comment, setComment] = useState('');
  const [commentPrivate, setCommentPrivate] = useState(false);

  const { data: feedback } = useQuery<FeedbackList>({
    queryKey: ['feedback', workId],
    queryFn: () => feedbackApi.list(workId),
  });
  const openBlocking = feedback?.summary.blockingOpen ?? 0;
  const draftBlocking = drafts.filter((d) => d.severity === 'BLOCKING').length;
  const approveBlockedBy = openBlocking + draftBlocking;

  const review = useMutation({
    mutationFn: (status: 'APPROVED' | 'NEEDS_REVISION') =>
      advancesApi.review(workId, advanceId, {
        status,
        items: drafts,
        comment: comment.trim() || undefined,
        commentPrivate: comment.trim() ? commentPrivate : undefined,
      }),
    onSuccess: (_r, status) => {
      toast.success(status === 'APPROVED' ? 'Avance aprobado' : 'Cambios solicitados al estudiante');
      setDrafts([]);
      setComment('');
      qc.invalidateQueries({ queryKey: invalidateKey });
      qc.invalidateQueries({ queryKey: ['feedback', workId] });
      qc.invalidateQueries({ queryKey: ['advisor-profile'] });
    },
    onError: (e: any) => {
      const msg = e?.response?.data?.message;
      toast.error(Array.isArray(msg) ? msg[0] : msg ?? 'No se pudo guardar la revisión');
    },
  });

  const addDraft = () => {
    if (form.text.trim().length < 3) return;
    setDrafts((d) => [...d, { ...form, text: form.text.trim(), location: form.location.trim() || undefined }]);
    setForm((f) => ({ ...EMPTY, category: f.category }));
  };

  const canRequest = drafts.length > 0 || comment.trim().length > 0;

  return (
    <div className="pt-3 border-t border-gray-100 space-y-3">
      <p className="text-xs font-semibold text-gray-700">Observaciones para esta versión</p>

      {drafts.length > 0 && (
        <ul className="space-y-1.5">
          {drafts.map((d, i) => (
            <li key={i} className="flex items-start gap-2 text-sm bg-gray-50 rounded-lg px-3 py-2">
              <span className={cn('text-[11px] font-medium rounded-full px-2 py-0.5 ring-1 ring-inset flex-shrink-0 mt-px', SEVERITY[d.severity].pill)}>
                {SEVERITY[d.severity].label}
              </span>
              <span className="flex-1 min-w-0 text-gray-800">
                {d.text}
                <span className="block text-[11px] text-gray-500">
                  {CATEGORY[d.category]}{d.location ? ` · ${d.location}` : ''}
                </span>
              </span>
              <button type="button" onClick={() => setDrafts((ds) => ds.filter((_, j) => j !== i))}
                className="p-0.5 text-gray-400 hover:text-red-600" aria-label="Quitar observación">
                <X className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Nueva observación */}
      <div className="rounded-xl border border-dashed border-gray-300 p-3 space-y-2">
        <textarea
          rows={2}
          className="input text-sm"
          placeholder="Qué debe corregir el estudiante…"
          aria-label="Texto de la observación"
          value={form.text}
          onChange={(e) => setForm({ ...form, text: e.target.value })}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) addDraft(); }}
        />
        <div className="grid grid-cols-2 sm:grid-cols-[1fr_1fr_1.2fr_auto] gap-2">
          <select className="input text-sm" aria-label="Severidad" value={form.severity}
            onChange={(e) => setForm({ ...form, severity: e.target.value as FeedbackSeverity })}>
            {SEVERITY_ORDER.map((s) => <option key={s} value={s}>{SEVERITY[s].label}</option>)}
          </select>
          <select className="input text-sm" aria-label="Categoría" value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value as FeedbackCategory })}>
            {Object.entries(CATEGORY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <input className="input text-sm col-span-2 sm:col-span-1" placeholder="Dónde (cap., pág.)" aria-label="Ubicación"
            maxLength={120} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          <button type="button" onClick={addDraft} disabled={form.text.trim().length < 3}
            className="btn-secondary text-sm inline-flex items-center justify-center gap-1 col-span-2 sm:col-span-1 disabled:opacity-40">
            <Plus className="w-4 h-4" /> Agregar
          </button>
        </div>
        <p className="text-[11px] text-gray-400">{SEVERITY[form.severity].hint}.</p>
      </div>

      {/* Comentario general */}
      <div className="space-y-1.5">
        <input
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={commentPrivate ? 'Nota privada para jurado y coordinación…' : 'Comentario general para el estudiante (opcional)…'}
          className={cn('input text-sm', commentPrivate && 'bg-amber-50/60 border-amber-200')}
          maxLength={4000}
        />
        <label className="inline-flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
          <input type="checkbox" className="rounded border-gray-300 text-unphu-600" checked={commentPrivate}
            onChange={(e) => setCommentPrivate(e.target.checked)} />
          <Lock className="w-3 h-3" /> Comentario privado (no lo ve el estudiante)
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => review.mutate('NEEDS_REVISION')}
          disabled={!canRequest || review.isPending}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 hover:bg-orange-700 disabled:opacity-40 text-white text-sm rounded-lg"
        >
          <Send className="w-3.5 h-3.5" /> Solicitar cambios{drafts.length ? ` (${drafts.length})` : ''}
        </button>
        <button
          type="button"
          onClick={() => review.mutate('APPROVED')}
          disabled={approveBlockedBy > 0 || review.isPending}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white text-sm rounded-lg"
        >
          <CheckCircle className="w-3.5 h-3.5" /> {drafts.length ? `Aprobar con ${drafts.length} sugerencia${drafts.length === 1 ? '' : 's'}` : 'Aprobar'}
        </button>
        {approveBlockedBy > 0 && (
          <span className="text-xs text-red-700">
            {approveBlockedBy === 1 ? 'Hay 1 observación bloqueante' : `Hay ${approveBlockedBy} observaciones bloqueantes`} sin resolver.
          </span>
        )}
      </div>
    </div>
  );
}
