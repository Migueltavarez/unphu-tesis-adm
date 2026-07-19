'use client';
import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { thesisApi, advancesApi, thesisDocumentsApi, meetingsApi } from '@/lib/api';
import { formatDate, STATUS_LABELS } from '@/lib/utils';
import StatusBadge from '@/components/ui/StatusBadge';
import ProcessTimeline from '@/components/ui/ProcessTimeline';
import ChatPanel from '@/components/ui/ChatPanel';
import { ArrowLeft, Upload, CheckCircle, XCircle, FileText, BookOpen, ChevronRight, Eye, CalendarPlus, MapPin, Link2, AlignLeft, CheckSquare, Trash2, Calendar } from 'lucide-react';

export default function AdvisorWorkDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [advanceNotes, setAdvanceNotes] = useState<Record<string, string>>({});
  const [comment, setComment] = useState<Record<string, string>>({});
  const [showMeetingForm, setShowMeetingForm] = useState(false);
  const [meetingForm, setMeetingForm] = useState({ scheduledAt: '', location: '', virtualLink: '', agenda: '' });

  const { data: work, isLoading } = useQuery({
    queryKey: ['advisor-work', id],
    queryFn: () => thesisApi.getById(id),
    enabled: !!id,
  });

  const { data: thesisDoc } = useQuery({
    queryKey: ['thesis-document-advisor', id],
    queryFn: () => thesisDocumentsApi.getOrCreate(id),
    enabled: !!id,
    retry: false,
  });

  const { data: meetings = [] } = useQuery({
    queryKey: ['meetings', id],
    queryFn: () => meetingsApi.list(id),
    enabled: !!id,
  });

  const createMeetingMutation = useMutation({
    mutationFn: (data: any) => meetingsApi.create(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meetings', id] });
      setShowMeetingForm(false);
      setMeetingForm({ scheduledAt: '', location: '', virtualLink: '', agenda: '' });
    },
  });

  const completeMeetingMutation = useMutation({
    mutationFn: (meetingId: string) => meetingsApi.complete(meetingId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['meetings', id] }),
  });

  const cancelMeetingMutation = useMutation({
    mutationFn: (meetingId: string) => meetingsApi.cancel(meetingId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['meetings', id] }),
  });

  const approveMutation = useMutation({
    mutationFn: ({ advId, comment }: { advId: string; comment?: string }) =>
      advancesApi.review(id, advId, { status: 'APPROVED', comment }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['advisor-work', id] }),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ advId, comment }: { advId: string; comment?: string }) =>
      advancesApi.review(id, advId, { status: 'NEEDS_REVISION', comment }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['advisor-work', id] }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-unphu-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!work) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500">Trabajo no encontrado.</p>
        <Link href="/dashboard/advisor/works" className="btn-secondary mt-4 inline-flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" /> Volver
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Link href="/dashboard/advisor/works" className="text-gray-400 hover:text-gray-600 mt-1">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{work.title}</h1>
              <p className="text-gray-500 text-sm mt-1">
                {work.student?.user?.firstName} {work.student?.user?.lastName} ·
                Matrícula {work.student?.matricula}
              </p>
            </div>
            <StatusBadge status={work.status} />
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main */}
        <div className="lg:col-span-2 space-y-6">
          {/* Abstract */}
          {work.abstract && (
            <div className="card p-6">
              <h2 className="font-semibold text-gray-900 mb-3">Resumen</h2>
              <p className="text-sm text-gray-600">{work.abstract}</p>
            </div>
          )}

          {/* Documento de tesis – nodos */}
          {thesisDoc && (() => {
            const flatNodes = (nodes: any[]): any[] => nodes.flatMap((n) => [n, ...flatNodes(n.children ?? [])]);
            const allNodes: any[] = flatNodes(thesisDoc.nodes ?? []).sort((a, b) => a.order - b.order);
            const pending = allNodes.filter((n) => n.status === 'PENDING_REVIEW');
            const NODE_STATUS_COLORS: Record<string, string> = {
              DRAFT: 'bg-gray-100 text-gray-500',
              IN_PROGRESS: 'bg-blue-50 text-blue-600',
              PENDING_REVIEW: 'bg-amber-50 text-amber-700',
              RETURNED: 'bg-red-50 text-red-600',
              APPROVED: 'bg-green-50 text-green-700',
            };
            const NODE_STATUS_LABELS: Record<string, string> = {
              DRAFT: 'Borrador', IN_PROGRESS: 'En progreso',
              PENDING_REVIEW: 'Pendiente revisión', RETURNED: 'Devuelto', APPROVED: 'Aprobado',
            };
            return (
              <div className="card overflow-hidden">
                <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
                  <h2 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
                    <BookOpen className="w-4 h-4" />
                    Documento de tesis
                    {pending.length > 0 && (
                      <span className="bg-amber-500 text-white text-xs rounded-full px-1.5">{pending.length} pendiente{pending.length !== 1 ? 's' : ''}</span>
                    )}
                  </h2>
                  <span className="text-xs text-gray-400">{allNodes.length} secciones</span>
                </div>
                <div className="divide-y divide-gray-50">
                  {allNodes.map((node) => (
                    <Link
                      key={node.id}
                      href={`/dashboard/advisor/review/${node.id}`}
                      className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors group"
                    >
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${NODE_STATUS_COLORS[node.status] ?? 'bg-gray-100 text-gray-500'}`}>
                        {NODE_STATUS_LABELS[node.status] ?? node.status}
                      </span>
                      <span className="text-sm text-gray-800 flex-1 truncate">{node.name}</span>
                      {node.status === 'PENDING_REVIEW' && (
                        <Eye className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                      )}
                      <ChevronRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-gray-500 flex-shrink-0" />
                    </Link>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Chat con el estudiante */}
          <ChatPanel
            thesisWorkId={id}
            title={`Chat con ${work.student?.user?.firstName ?? 'el estudiante'} ${work.student?.user?.lastName ?? ''}`}
          />

          {/* Advances */}
          <div className="card p-6">
            <h2 className="font-semibold text-gray-900 mb-4">
              Avances del estudiante ({work.advances?.length ?? 0})
            </h2>

            {(!work.advances || work.advances.length === 0) ? (
              <div className="text-center py-8 text-gray-400">
                <Upload className="w-8 h-8 mx-auto mb-2" />
                <p className="text-sm">El estudiante no ha enviado avances todavía</p>
              </div>
            ) : (
              <div className="space-y-4">
                {work.advances.map((adv: any) => (
                  <div key={adv.id} className="border border-gray-100 rounded-xl p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-gray-900">{adv.title}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{formatDate(adv.createdAt)}</p>
                      </div>
                      <span className={`badge ${
                        adv.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
                        adv.status === 'NEEDS_REVISION' ? 'bg-red-100 text-red-700' :
                        adv.status === 'UNDER_REVIEW' ? 'bg-blue-100 text-blue-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {adv.status === 'APPROVED' ? 'Aprobado' :
                         adv.status === 'NEEDS_REVISION' ? 'Necesita revisión' :
                         adv.status === 'UNDER_REVIEW' ? 'En revisión' : 'Enviado'}
                      </span>
                    </div>

                    {adv.content && (
                      <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">{adv.content}</p>
                    )}

                    {/* Documents */}
                    {adv.documents?.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {adv.documents.map((doc: any) => (
                          <a
                            key={doc.id}
                            href={doc.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs text-unphu-600 hover:underline"
                          >
                            <FileText className="w-3 h-3" /> {doc.name}
                          </a>
                        ))}
                      </div>
                    )}

                    {/* Comments */}
                    {adv.comments?.length > 0 && (
                      <div className="space-y-2 pt-2 border-t border-gray-100">
                        {adv.comments.map((c: any) => (
                          <div key={c.id} className="flex gap-2">
                            <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold flex-shrink-0">
                              {(c.author?.firstName || c.user?.firstName)?.[0] ?? '?'}
                            </div>
                            <div className="bg-gray-50 rounded-lg px-3 py-2 flex-1">
                              <p className="text-xs font-medium text-gray-700">
                                {c.author?.firstName || c.user?.firstName} {c.author?.lastName || c.user?.lastName}
                              </p>
                              <p className="text-xs text-gray-600 mt-0.5">{c.content}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Review actions */}
                    {['SUBMITTED', 'UNDER_REVIEW'].includes(adv.status) && (
                      <div className="pt-3 border-t border-gray-100 space-y-2">
                        <input
                          value={advanceNotes[adv.id] || ''}
                          onChange={(e) => setAdvanceNotes((prev) => ({ ...prev, [adv.id]: e.target.value }))}
                          placeholder="Comentario para el estudiante..."
                          className="input text-sm"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => approveMutation.mutate({ advId: adv.id, comment: advanceNotes[adv.id] })}
                            disabled={approveMutation.isPending}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg"
                          >
                            <CheckCircle className="w-3.5 h-3.5" /> Aprobar
                          </button>
                          <button
                            onClick={() => rejectMutation.mutate({ advId: adv.id, comment: advanceNotes[adv.id] })}
                            disabled={rejectMutation.isPending}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white text-sm rounded-lg"
                          >
                            <XCircle className="w-3.5 h-3.5" /> Pedir revisión
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Timeline */}
        <div className="space-y-6">
          <div className="card p-5">
            <h3 className="font-semibold text-gray-900 mb-4 text-sm">Progreso del proceso</h3>
            <ProcessTimeline currentStatus={work.status} />
          </div>

          {/* Reuniones */}
          <div className="card overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
                <Calendar className="w-4 h-4 text-unphu-600" />
                Reuniones
              </h3>
              <button
                onClick={() => setShowMeetingForm((v) => !v)}
                className="flex items-center gap-1 text-xs text-unphu-600 hover:text-unphu-700 font-medium"
              >
                <CalendarPlus className="w-3.5 h-3.5" />
                Programar
              </button>
            </div>

            {showMeetingForm && (
              <div className="px-5 py-4 border-b border-gray-100 space-y-3 bg-gray-50">
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Fecha y hora *</label>
                  <input
                    type="datetime-local"
                    value={meetingForm.scheduledAt}
                    onChange={(e) => setMeetingForm((f) => ({ ...f, scheduledAt: e.target.value }))}
                    className="input text-sm w-full"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1 flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> Lugar
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Sala 301, Edificio A"
                    value={meetingForm.location}
                    onChange={(e) => setMeetingForm((f) => ({ ...f, location: e.target.value }))}
                    className="input text-sm w-full"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1 flex items-center gap-1">
                    <Link2 className="w-3 h-3" /> Enlace virtual
                  </label>
                  <input
                    type="url"
                    placeholder="https://meet.google.com/..."
                    value={meetingForm.virtualLink}
                    onChange={(e) => setMeetingForm((f) => ({ ...f, virtualLink: e.target.value }))}
                    className="input text-sm w-full"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1 flex items-center gap-1">
                    <AlignLeft className="w-3 h-3" /> Agenda
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Temas a tratar..."
                    value={meetingForm.agenda}
                    onChange={(e) => setMeetingForm((f) => ({ ...f, agenda: e.target.value }))}
                    className="input text-sm w-full resize-none"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => createMeetingMutation.mutate({ ...meetingForm, scheduledAt: new Date(meetingForm.scheduledAt).toISOString() })}
                    disabled={!meetingForm.scheduledAt || createMeetingMutation.isPending}
                    className="flex-1 btn-primary text-sm py-1.5"
                  >
                    {createMeetingMutation.isPending ? 'Guardando...' : 'Programar reunión'}
                  </button>
                  <button onClick={() => setShowMeetingForm(false)} className="btn-secondary text-sm py-1.5 px-3">
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            <div className="divide-y divide-gray-50">
              {(meetings as any[]).length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-6">No hay reuniones programadas</p>
              ) : (
                (meetings as any[]).map((m: any) => (
                  <div key={m.id} className={`px-5 py-3 space-y-1 ${m.completed ? 'opacity-60' : ''}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-900">
                          {new Date(m.scheduledAt).toLocaleString('es-DO', { dateStyle: 'medium', timeStyle: 'short' })}
                        </p>
                        {m.location && (
                          <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                            <MapPin className="w-2.5 h-2.5 flex-shrink-0" /> {m.location}
                          </p>
                        )}
                        {m.virtualLink && (
                          <a href={m.virtualLink} target="_blank" rel="noopener noreferrer" className="text-xs text-unphu-600 hover:underline flex items-center gap-1 mt-0.5">
                            <Link2 className="w-2.5 h-2.5 flex-shrink-0" /> Enlace virtual
                          </a>
                        )}
                      </div>
                      {!m.completed && (
                        <div className="flex gap-1 flex-shrink-0">
                          <button
                            onClick={() => completeMeetingMutation.mutate(m.id)}
                            title="Marcar completada"
                            className="text-green-600 hover:text-green-700 p-0.5"
                          >
                            <CheckSquare className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => cancelMeetingMutation.mutate(m.id)}
                            title="Cancelar"
                            className="text-red-400 hover:text-red-600 p-0.5"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                      {m.completed && (
                        <span className="text-xs text-green-600 font-medium flex-shrink-0">Completada</span>
                      )}
                    </div>
                    {m.agenda && (
                      <p className="text-xs text-gray-500 bg-gray-50 rounded px-2 py-1 line-clamp-2">{m.agenda}</p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Info */}
          <div className="card p-5 space-y-3">
            <h3 className="font-semibold text-gray-900 text-sm">Detalles</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Tipo</span>
                <span className="text-gray-900">{work.type === 'TESIS' ? 'Tesis' : 'Monográfico'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Año</span>
                <span className="text-gray-900">{work.year}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Carrera</span>
                <span className="text-gray-900">{work.career?.code}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Avances</span>
                <span className="text-gray-900">{work.advances?.length ?? 0}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
