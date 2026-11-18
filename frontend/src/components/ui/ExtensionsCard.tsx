'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { AlertTriangle, CalendarClock, FileText, Paperclip } from 'lucide-react';
import { documentsApi, extensionsApi } from '@/lib/api';
import { cn, formatDate } from '@/lib/utils';
import { ExtensionList, ExtensionRequestItem, ExtensionStatus } from '@/types';

const STATUS: Record<ExtensionStatus, { label: string; pill: string }> = {
  PENDING_ADVISOR:     { label: 'Esperando aval del asesor', pill: 'bg-amber-50 text-amber-800 ring-amber-200' },
  PENDING_COORDINATOR: { label: 'Esperando a Coordinación',  pill: 'bg-sky-50 text-sky-800 ring-sky-200' },
  APPROVED:            { label: 'Aprobada',                  pill: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  REJECTED:            { label: 'Rechazada',                 pill: 'bg-red-50 text-red-700 ring-red-200' },
  CANCELLED:           { label: 'Cancelada',                 pill: 'bg-gray-50 text-gray-500 ring-gray-200' },
};

type Decision = { id: string; kind: 'endorse' | 'advisorReject' | 'approve' | 'reject'; days?: number } | null;

const errMsg = (e: any, fallback: string) => {
  const m = e?.response?.data?.message;
  return Array.isArray(m) ? m[0] : m ?? fallback;
};

export default function ExtensionsCard({ workId }: { workId: string }) {
  const qc = useQueryClient();
  const key = ['extensions', workId];
  const { data, isLoading } = useQuery<ExtensionList>({ queryKey: key, queryFn: () => extensionsApi.list(workId), enabled: !!workId });

  const [showForm, setShowForm] = useState(false);
  const [days, setDays] = useState(30);
  const [reason, setReason] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [decision, setDecision] = useState<Decision>(null);
  const [note, setNote] = useState('');

  const refresh = (list: ExtensionList) => {
    qc.setQueryData(key, list);
    qc.invalidateQueries({ queryKey: ['milestones', workId] });
    qc.invalidateQueries({ queryKey: ['extensions-pending'] });
    qc.invalidateQueries({ queryKey: ['risk-summary'] });
  };

  const create = useMutation({
    mutationFn: async () => {
      let documentId: string | undefined;
      if (file) {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('type', 'OTHER');
        documentId = (await documentsApi.upload(workId, fd)).id;
      }
      return extensionsApi.create(workId, { days, reason: reason.trim(), documentId });
    },
    onSuccess: (list) => {
      refresh(list);
      toast.success('Solicitud enviada');
      setShowForm(false);
      setReason('');
      setFile(null);
    },
    onError: (e) => toast.error(errMsg(e, 'No se pudo enviar la solicitud')),
  });

  const act = useMutation({
    mutationFn: ({ id, kind, days, note }: { id: string; kind: string; days?: number; note?: string }) => {
      if (kind === 'cancel') return extensionsApi.cancel(id);
      if (kind === 'endorse') return extensionsApi.endorse(id, note);
      if (kind === 'advisorReject') return extensionsApi.advisorReject(id, note ?? '');
      if (kind === 'approve') return extensionsApi.approve(id, days, note);
      return extensionsApi.reject(id, note ?? '');
    },
    onSuccess: (list, { kind }) => {
      refresh(list);
      setDecision(null);
      setNote('');
      toast.success({ cancel: 'Solicitud cancelada', endorse: 'Prórroga avalada', advisorReject: 'Prórroga no avalada', approve: 'Prórroga aprobada', reject: 'Prórroga rechazada' }[kind] ?? 'Listo');
    },
    onError: (e) => toast.error(errMsg(e, 'No se pudo registrar la decisión')),
  });

  const download = async (docId: string) => {
    try {
      const { url } = await documentsApi.download(workId, docId);
      window.open(url, '_blank', 'noopener');
    } catch (e) {
      toast.error(errMsg(e, 'No se pudo abrir el documento'));
    }
  };

  if (isLoading || !data) {
    return (
      <div className="card p-5">
        <h3 className="font-semibold text-gray-900 text-sm">Prórrogas</h3>
        <div className="h-16 mt-4 rounded-lg bg-gray-50 animate-pulse" />
      </div>
    );
  }

  const { rules } = data;
  const reasonOk = reason.trim().length >= rules.minReason;
  const needsNote = decision && (decision.kind === 'advisorReject' || decision.kind === 'reject');

  return (
    <div className="card p-5">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
          <CalendarClock className="w-4 h-4 text-unphu-600" /> Prórrogas
        </h3>
        {data.approvedDays > 0 && (
          <span className="text-xs text-emerald-700 font-medium tabular-nums">{data.approvedDays} días concedidos</span>
        )}
      </div>

      {/* Solicitud (estudiante) */}
      {data.canRequest && !showForm && (
        <button type="button" onClick={() => setShowForm(true)} className="btn-secondary text-sm mt-3 w-full">
          Solicitar prórroga
        </button>
      )}
      {!data.canRequest && data.requestBlockedReason && data.items.length === 0 && (
        <p className="text-xs text-gray-500 mt-3">{data.requestBlockedReason}.</p>
      )}
      {showForm && (
        <div className="mt-3 space-y-2.5 rounded-xl border border-gray-200 p-3">
          <div>
            <label className="label" htmlFor="ext-days">Días que necesitas</label>
            <input id="ext-days" type="number" min={rules.minDays} max={rules.maxDays} className="input tabular-nums"
              value={days} onChange={(e) => setDays(Number(e.target.value))} />
          </div>
          <div>
            <label className="label" htmlFor="ext-reason">Justificación</label>
            <textarea id="ext-reason" rows={3} className="input text-sm" maxLength={3000}
              placeholder="Explica qué pasó y por qué necesitas más tiempo…"
              value={reason} onChange={(e) => setReason(e.target.value)} />
            <p className={cn('text-[11px] mt-1', reasonOk ? 'text-gray-400' : 'text-amber-700')}>
              {reasonOk ? 'Tu asesor la avala y Coordinación decide.' : `Mínimo ${rules.minReason} caracteres (${reason.trim().length}/${rules.minReason}).`}
            </p>
          </div>
          <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
            <Paperclip className="w-3.5 h-3.5" />
            <span className="truncate">{file ? file.name : 'Adjuntar respaldo (certificado médico, constancia…)'}</span>
            <input type="file" className="sr-only" accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
          <div className="flex gap-2">
            <button type="button" className="btn-primary text-sm flex-1"
              disabled={!reasonOk || days < rules.minDays || days > rules.maxDays || create.isPending}
              onClick={() => create.mutate()}>
              {create.isPending ? 'Enviando…' : 'Enviar solicitud'}
            </button>
            <button type="button" className="btn-secondary text-sm" onClick={() => setShowForm(false)}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Historial */}
      {data.items.length === 0 ? (
        !data.canRequest && !data.requestBlockedReason && <p className="text-sm text-gray-500 mt-3">Sin solicitudes de prórroga.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {data.items.map((e: ExtensionRequestItem) => (
            <li key={e.id} className="rounded-xl border border-gray-200 p-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className={cn('text-[11px] font-medium rounded-full px-2 py-0.5 ring-1 ring-inset', STATUS[e.status].pill)}>
                  {STATUS[e.status].label}
                </span>
                {e.escalated && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-700">
                    <AlertTriangle className="w-3 h-3" /> {e.waitingDays} días sin respuesta
                  </span>
                )}
              </div>
              <p className="text-sm font-medium text-gray-900 mt-2 tabular-nums">
                {e.days} días solicitados
                {e.status === 'APPROVED' && e.approvedDays !== e.days && <span className="text-emerald-700"> · {e.approvedDays} concedidos</span>}
              </p>
              <p className="text-sm text-gray-600 mt-0.5 whitespace-pre-line">{e.reason}</p>
              {e.document && (
                <button type="button" onClick={() => download(e.document!.id)}
                  className="mt-1.5 inline-flex items-center gap-1 text-xs text-unphu-700 hover:underline">
                  <FileText className="w-3 h-3" /> {e.document.name}
                </button>
              )}
              {e.advisorNote && <p className="text-xs text-gray-600 bg-gray-50 rounded-md px-2 py-1 mt-2">Asesor: {e.advisorNote}</p>}
              {e.coordinatorNote && <p className="text-xs text-gray-600 bg-gray-50 rounded-md px-2 py-1 mt-1.5">Coordinación: {e.coordinatorNote}</p>}
              <p className="text-[11px] text-gray-400 mt-1.5">
                Solicitada el {formatDate(e.createdAt)}
                {e.coordinatorDecidedAt && ` · decidida el ${formatDate(e.coordinatorDecidedAt)}`}
              </p>

              {/* Decisión en curso */}
              {decision?.id === e.id ? (
                <div className="mt-2 space-y-2">
                  {decision.kind === 'approve' && (
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-gray-600" htmlFor={`days-${e.id}`}>Días a conceder</label>
                      <input id={`days-${e.id}`} type="number" min={1} max={rules.maxDays} className="input w-24 text-sm tabular-nums"
                        value={decision.days ?? e.days} onChange={(ev) => setDecision({ ...decision, days: Number(ev.target.value) })} />
                    </div>
                  )}
                  <textarea autoFocus rows={2} className="input text-sm" maxLength={2000} value={note} onChange={(ev) => setNote(ev.target.value)}
                    placeholder={needsNote ? 'Motivo (obligatorio, lo verá el estudiante)' : 'Nota (opcional)'} />
                  <div className="flex gap-2">
                    <button type="button" className="btn-primary text-xs px-3 py-1.5"
                      disabled={act.isPending || (!!needsNote && note.trim().length < 10)}
                      onClick={() => act.mutate({ id: e.id, kind: decision.kind, days: decision.days, note: note.trim() || undefined })}>
                      Confirmar
                    </button>
                    <button type="button" className="btn-secondary text-xs px-3 py-1.5" onClick={() => { setDecision(null); setNote(''); }}>Cancelar</button>
                  </div>
                </div>
              ) : (
                (e.can.cancel || e.can.advisorDecide || e.can.coordinatorDecide) && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {e.can.advisorDecide && (
                      <>
                        <button type="button" onClick={() => setDecision({ id: e.id, kind: 'endorse' })}
                          className="text-xs font-medium rounded-md px-2.5 py-1 text-emerald-700 bg-emerald-50 hover:bg-emerald-100">Avalar</button>
                        <button type="button" onClick={() => setDecision({ id: e.id, kind: 'advisorReject' })}
                          className="text-xs font-medium rounded-md px-2.5 py-1 text-red-700 hover:bg-red-50">No avalar</button>
                      </>
                    )}
                    {e.can.coordinatorDecide && (
                      <>
                        <button type="button" onClick={() => setDecision({ id: e.id, kind: 'approve', days: e.days })}
                          className="text-xs font-medium rounded-md px-2.5 py-1 text-emerald-700 bg-emerald-50 hover:bg-emerald-100">Aprobar</button>
                        <button type="button" onClick={() => setDecision({ id: e.id, kind: 'reject' })}
                          className="text-xs font-medium rounded-md px-2.5 py-1 text-red-700 hover:bg-red-50">Rechazar</button>
                      </>
                    )}
                    {e.can.cancel && (
                      <button type="button" disabled={act.isPending} onClick={() => act.mutate({ id: e.id, kind: 'cancel' })}
                        className="text-xs font-medium rounded-md px-2.5 py-1 text-gray-500 hover:bg-gray-100">Cancelar solicitud</button>
                    )}
                  </div>
                )
              )}
            </li>
          ))}
        </ul>
      )}
      {data.items.length > 0 && data.requestBlockedReason && !data.canRequest && data.items.every((i) => !i.can.cancel) && (
        <p className="text-[11px] text-gray-400 mt-3">{data.requestBlockedReason}.</p>
      )}
    </div>
  );
}
