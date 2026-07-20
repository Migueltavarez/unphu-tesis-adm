'use client';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { thesisApi, advisorsApi, presentationsApi, usersApi } from '@/lib/api';
import { formatDate, STATUS_LABELS } from '@/lib/utils';
import StatusBadge from '@/components/ui/StatusBadge';
import ProcessTimeline from '@/components/ui/ProcessTimeline';
import ChatPanel from '@/components/ui/ChatPanel';
import { ArrowLeft, User, FileText, CheckCircle, XCircle, Clock, CalendarDays, Star, BookOpen, X } from 'lucide-react';

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  POSTULATION:          ['ACADEMIC_VALIDATION', 'REJECTED'],
  ACADEMIC_VALIDATION:  ['PROPOSAL_FORM', 'REJECTED'],
  PROPOSAL_FORM:        [],  // El estudiante llena y envía desde su panel
  PROPOSAL_REVIEW:      ['PROPOSAL_APPROVED', 'PROPOSAL_FORM', 'REJECTED'],
  PROPOSAL_APPROVED:    ['REGISTRO_PROCESSING', 'REJECTED'],
  REGISTRO_PROCESSING:  [],  // Registro marca como REGISTERED
  REGISTERED:           [],  // Cobros fija el monto → CAJA_PENDING
  COBROS_PROCESSING:    [],  // flujo interno de cobros
  CAJA_PENDING:         [],  // Caja confirma el pago
  PAYMENT_CONFIRMED:    ['FACULTY_MEETING', 'REJECTED'],
  FACULTY_MEETING:      ['DRAFT_IN_PROGRESS', 'REJECTED'],
  DRAFT_IN_PROGRESS:    ['DRAFT_UNDER_REVIEW', 'REJECTED'],
  DRAFT_UNDER_REVIEW:   ['DRAFT_APPROVED', 'DRAFT_IN_PROGRESS', 'REJECTED'],
  DRAFT_APPROVED:       ['ADVISOR_ASSIGNED'],
  ADVISOR_ASSIGNED:     ['WORK_STARTED', 'REJECTED'],
  WORK_STARTED:         ['IN_DEVELOPMENT'],
  IN_DEVELOPMENT:       ['ADVANCES_SUBMITTED', 'WORK_COMPLETED'],
  ADVANCES_SUBMITTED:   ['ADVISOR_FEEDBACK', 'IN_DEVELOPMENT'],
  ADVISOR_FEEDBACK:     ['IN_DEVELOPMENT', 'WORK_COMPLETED'],
  WORK_COMPLETED:       ['REJECTED'],
  PRESENTATION_SCHEDULED: ['PRESENTATION_DONE'],
  PRESENTATION_DONE:    ['GRADED'],
  GRADED:               ['APPROVED', 'REJECTED'],
  APPROVED:             ['PUBLISHED'],
};

export default function CoordinatorWorkDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState('');
  const [selectedAdvisor, setSelectedAdvisor] = useState('');

  const { data: work, isLoading } = useQuery({
    queryKey: ['work', id],
    queryFn: () => thesisApi.getById(id),
    enabled: !!id,
  });

  const { data: advisors } = useQuery({
    queryKey: ['advisors'],
    queryFn: () => advisorsApi.list(),
  });

  const statusMutation = useMutation({
    mutationFn: ({ status, notes }: { status: string; notes?: string }) =>
      thesisApi.updateStatus(id, status, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work', id] });
      queryClient.invalidateQueries({ queryKey: ['coordinator-works'] });
      setNotes('');
    },
  });

  const advisorMutation = useMutation({
    mutationFn: (advisorId: string) => thesisApi.assignAdvisor(id, advisorId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work', id] });
      setSelectedAdvisor('');
    },
  });

  const [showPublishModal, setShowPublishModal] = useState(false);
  const [publishAbstract, setPublishAbstract] = useState('');
  const [publishKeywords, setPublishKeywords] = useState('');

  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [rescheduleForm, setRescheduleForm] = useState({
    scheduledAt: '',
    location: '',
    virtualLink: '',
    juryMembers: '',
  });

  const { data: juradoUsers } = useQuery({
    queryKey: ['jurado-users'],
    queryFn: () => usersApi.list({ role: 'JURADO' }),
  });

  const rescheduleMutation = useMutation({
    mutationFn: () => presentationsApi.reschedule(id, {
      scheduledAt: rescheduleForm.scheduledAt,
      location: rescheduleForm.location || undefined,
      virtualLink: rescheduleForm.virtualLink || undefined,
      juryMembers: rescheduleForm.juryMembers.split(',').map((s) => s.trim()).filter(Boolean),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work', id] });
      setShowRescheduleModal(false);
    },
  });

  const [presentationForm, setPresentationForm] = useState({
    scheduledAt: '',
    location: '',
    virtualLink: '',
    juryMembers: '',
  });

  const publishMutation = useMutation({
    mutationFn: async ({ abstract, keywords }: { abstract: string; keywords: string[] }) => {
      if (abstract || keywords.length > 0) {
        await thesisApi.update(id, {
          abstract: abstract || undefined,
          keywords: keywords.length > 0 ? keywords : undefined,
        });
      }
      return thesisApi.updateStatus(id, 'PUBLISHED', 'Trabajo publicado en el repositorio institucional.');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work', id] });
      queryClient.invalidateQueries({ queryKey: ['coordinator-works'] });
      setShowPublishModal(false);
    },
  });

  const scheduleMutation = useMutation({
    mutationFn: () => presentationsApi.schedule(id, {
      scheduledAt: presentationForm.scheduledAt,
      location: presentationForm.location || undefined,
      virtualLink: presentationForm.virtualLink || undefined,
      juryMembers: presentationForm.juryMembers.split(',').map((s) => s.trim()).filter(Boolean),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work', id] });
      setPresentationForm({ scheduledAt: '', location: '', virtualLink: '', juryMembers: '' });
    },
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
        <Link href="/dashboard/coordinator/works" className="btn-secondary mt-4 inline-flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" /> Volver
        </Link>
      </div>
    );
  }

  const nextStatuses = ALLOWED_TRANSITIONS[work.status] || [];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Link href="/dashboard/coordinator/works" className="text-gray-400 hover:text-gray-600 mt-1">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{work.title}</h1>
              <p className="text-gray-500 text-sm mt-1">
                {work.career?.name} · {work.type === 'TESIS' ? 'Tesis' : 'Monográfico'} · {work.year}
              </p>
            </div>
            <StatusBadge status={work.status} />
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left: info + actions */}
        <div className="lg:col-span-2 space-y-6">
          {/* Student info */}
          <div className="card p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Información del estudiante</h2>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-unphu-100 flex items-center justify-center">
                <User className="w-5 h-5 text-unphu-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">
                  {work.student?.user?.firstName} {work.student?.user?.lastName}
                </p>
                <p className="text-sm text-gray-500">
                  Matrícula: {work.student?.matricula} · {work.student?.user?.email}
                </p>
              </div>
            </div>
          </div>

          {/* Proposal form review (visible when coordinator is reviewing) */}
          {(['PROPOSAL_REVIEW', 'PROPOSAL_APPROVED', 'REGISTRO_PROCESSING'] as string[]).includes(work.status) && (
            <div className="card p-6 border-l-4 border-amber-400">
              <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-600" /> Formulario de propuesta enviado
              </h2>
              <div className="space-y-3 text-sm">
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">Estudiante</p>
                    <p className="font-medium text-gray-900">{work.student?.user?.firstName} {work.student?.user?.lastName}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">Matrícula</p>
                    <p className="font-medium text-gray-900">{work.student?.matricula}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">Carrera</p>
                    <p className="font-medium text-gray-900">{work.career?.name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">Tema propuesto</p>
                    <p className="font-medium text-gray-900">{work.title}</p>
                  </div>
                </div>
                {work.firma && (
                  <div className="pt-2 border-t border-gray-100">
                    <p className="text-xs text-gray-500 mb-1">Firma del estudiante</p>
                    <p className="text-gray-800 italic text-lg" style={{ fontFamily: 'cursive' }}>{work.firma}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Abstract */}
          {work.abstract && (
            <div className="card p-6">
              <h2 className="font-semibold text-gray-900 mb-3">Resumen</h2>
              <p className="text-sm text-gray-600">{work.abstract}</p>
              {work.keywords?.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {work.keywords.map((kw: string) => (
                    <span key={kw} className="badge bg-unphu-50 text-unphu-700">{kw}</span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Assign advisor */}
          <div className="card p-6">
            <h2 className="font-semibold text-gray-900 mb-4">
              {work.advisor ? 'Asesor asignado' : 'Asignar asesor'}
            </h2>
            {work.advisor ? (
              <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold">
                  {work.advisor.user?.firstName?.[0]}{work.advisor.user?.lastName?.[0]}
                </div>
                <div>
                  <p className="font-medium text-gray-900">
                    {work.advisor.user?.firstName} {work.advisor.user?.lastName}
                  </p>
                  <p className="text-sm text-gray-500">{work.advisor.user?.email}</p>
                </div>
              </div>
            ) : (
              <div className="flex gap-3">
                <select
                  value={selectedAdvisor}
                  onChange={(e) => setSelectedAdvisor(e.target.value)}
                  className="input flex-1 text-sm"
                >
                  <option value="">-- Seleccionar asesor --</option>
                  {advisors?.map((a: any) => (
                    <option key={a.id} value={a.id}>
                      {a.user?.firstName} {a.user?.lastName} ({a.worksCount ?? 0} trabajos activos)
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => selectedAdvisor && advisorMutation.mutate(selectedAdvisor)}
                  disabled={!selectedAdvisor || advisorMutation.isPending}
                  className="btn-primary text-sm px-4"
                >
                  {advisorMutation.isPending ? 'Asignando...' : 'Asignar'}
                </button>
              </div>
            )}
          </div>

          {/* Presentation scheduling */}
          {work.status === 'WORK_COMPLETED' && !work.presentation && (
            <div className="card p-6">
              <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <CalendarDays className="w-4 h-4" /> Programar presentación
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="label">Fecha y hora *</label>
                  <input
                    type="datetime-local"
                    value={presentationForm.scheduledAt}
                    onChange={(e) => setPresentationForm((p) => ({ ...p, scheduledAt: e.target.value }))}
                    className="input"
                    min={new Date().toISOString().slice(0, 16)}
                  />
                </div>
                <div>
                  <label className="label">Lugar (aula, sala)</label>
                  <input
                    value={presentationForm.location}
                    onChange={(e) => setPresentationForm((p) => ({ ...p, location: e.target.value }))}
                    className="input"
                    placeholder="Ej: Aula B-204"
                  />
                </div>
                <div>
                  <label className="label">Enlace virtual (opcional)</label>
                  <input
                    value={presentationForm.virtualLink}
                    onChange={(e) => setPresentationForm((p) => ({ ...p, virtualLink: e.target.value }))}
                    className="input"
                    placeholder="https://meet.google.com/..."
                  />
                </div>
                <div>
                  <label className="label">Miembros del jurado</label>
                  {juradoUsers?.length > 0 ? (
                    <div className="space-y-2">
                      {juradoUsers.map((u: any) => {
                        const name = `${u.firstName} ${u.lastName}`;
                        const selected = presentationForm.juryMembers.split(',').map((s: string) => s.trim()).filter(Boolean).includes(name);
                        return (
                          <label key={u.id} className="flex items-center gap-2 text-sm cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={() => {
                                const current = presentationForm.juryMembers.split(',').map((s: string) => s.trim()).filter(Boolean);
                                const updated = selected ? current.filter((n: string) => n !== name) : [...current, name];
                                setPresentationForm((p) => ({ ...p, juryMembers: updated.join(', ') }));
                              }}
                              className="rounded border-gray-300"
                            />
                            {name}
                          </label>
                        );
                      })}
                    </div>
                  ) : (
                    <input
                      value={presentationForm.juryMembers}
                      onChange={(e) => setPresentationForm((p) => ({ ...p, juryMembers: e.target.value }))}
                      className="input"
                      placeholder="Dr. García, Ing. Pérez (separados por comas)"
                    />
                  )}
                </div>
                <button
                  onClick={() => scheduleMutation.mutate()}
                  disabled={!presentationForm.scheduledAt || scheduleMutation.isPending}
                  className="btn-primary"
                >
                  {scheduleMutation.isPending ? 'Programando...' : 'Programar presentación'}
                </button>
                {scheduleMutation.isError && (
                  <p className="text-sm text-red-600">Error al programar. Intenta de nuevo.</p>
                )}
              </div>
            </div>
          )}

          {/* Presentation info (if already scheduled) */}
          {work.presentation && (
            <div className="card p-6 border-l-4 border-purple-400">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-purple-600" /> Presentación programada
                </h2>
                {!work.presentation.completed && (
                  <button
                    onClick={() => {
                      const p = work.presentation;
                      const dt = new Date(p.scheduledAt);
                      const localIso = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
                      setRescheduleForm({
                        scheduledAt: localIso,
                        location: p.location ?? '',
                        virtualLink: p.virtualLink ?? '',
                        juryMembers: (p.juryMembers ?? []).join(', '),
                      });
                      setShowRescheduleModal(true);
                    }}
                    className="text-xs text-purple-600 hover:text-purple-800 font-medium border border-purple-200 hover:border-purple-400 rounded-lg px-3 py-1.5 transition-colors"
                  >
                    Reagendar
                  </button>
                )}
              </div>
              <div className="space-y-1 text-sm text-gray-600">
                <p><span className="font-medium">Fecha:</span> {formatDate(work.presentation.scheduledAt, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                {work.presentation.location && <p><span className="font-medium">Lugar:</span> {work.presentation.location}</p>}
                {work.presentation.virtualLink && (
                  <p><span className="font-medium">Enlace:</span>{' '}
                    <a href={work.presentation.virtualLink} target="_blank" rel="noopener noreferrer" className="text-unphu-600 hover:underline">
                      {work.presentation.virtualLink}
                    </a>
                  </p>
                )}
                {work.presentation.juryMembers?.length > 0 && (
                  <p><span className="font-medium">Jurado:</span> {work.presentation.juryMembers.join(', ')}</p>
                )}
              </div>
            </div>
          )}

          {/* Jury grades (when available) */}
          {work.grades?.length > 0 && (
            <div className="card p-6">
              <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-500" /> Calificaciones del jurado
              </h2>
              <div className="space-y-3">
                {work.grades.map((grade: any) => {
                  const fg = grade.finalGrade;
                  return (
                    <div key={grade.id} className="flex items-start gap-4 p-3 bg-gray-50 dark:bg-gray-700/40 rounded-xl border border-gray-100 dark:border-gray-700">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-gray-900 dark:text-white">{grade.evaluatorName}</p>
                        {grade.observations && (
                          <p className="text-xs text-gray-500 mt-0.5 italic">"{grade.observations}"</p>
                        )}
                        <div className="flex gap-3 mt-1 text-xs text-gray-400">
                          {grade.writtenGrade != null && <span>Escrito: <strong>{grade.writtenGrade}</strong></span>}
                          {grade.oralGrade != null && <span>Oral: <strong>{grade.oralGrade}</strong></span>}
                        </div>
                      </div>
                      {fg != null && (
                        <div className={`text-center shrink-0 px-3 py-2 rounded-lg ${fg >= 70 ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300' : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'}`}>
                          <p className="text-xl font-bold">{fg}</p>
                          <p className="text-xs">{fg >= 70 ? 'Aprobado' : 'No aprobado'}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {work.grades.length > 0 && (() => {
                const gradesWithFinal = work.grades.filter((g: any) => g.finalGrade != null);
                if (gradesWithFinal.length === 0) return null;
                const avg = Math.round((gradesWithFinal.reduce((s: number, g: any) => s + g.finalGrade, 0) / gradesWithFinal.length) * 10) / 10;
                return (
                  <div className={`mt-4 text-center p-4 rounded-xl ${avg >= 70 ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'}`}>
                    <p className={`text-3xl font-bold ${avg >= 70 ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>{avg}</p>
                    <p className={`text-sm font-medium mt-1 ${avg >= 70 ? 'text-green-600' : 'text-red-600'}`}>
                      Promedio final · {avg >= 70 ? '✓ Aprobado' : '✗ No aprobado'} · {gradesWithFinal.length} de {Math.max(work.presentation?.juryMembers?.length ?? 0, gradesWithFinal.length)} jurados calificaron
                    </p>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Change status */}
          {nextStatuses.length > 0 && (
            <div className="card p-6">
              <h2 className="font-semibold text-gray-900 mb-4">Cambiar estado</h2>
              <div>
                <label className="label">Notas (opcional)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="input text-sm"
                  rows={2}
                  placeholder="Motivo del cambio, observaciones..."
                />
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                {nextStatuses.map((nextStatus) => (
                  <button
                    key={nextStatus}
                    onClick={() => {
                      if (nextStatus === 'PUBLISHED') {
                        setPublishAbstract(work.abstract ?? '');
                        setPublishKeywords((work.keywords ?? []).join(', '));
                        setShowPublishModal(true);
                      } else {
                        statusMutation.mutate({ status: nextStatus, notes });
                      }
                    }}
                    disabled={statusMutation.isPending}
                    className={`text-sm px-4 py-2 rounded-lg font-medium transition-colors ${
                      nextStatus === 'REJECTED'
                        ? 'bg-red-600 hover:bg-red-700 text-white'
                        : nextStatus === 'PUBLISHED'
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        : 'btn-primary'
                    }`}
                  >
                    {nextStatus === 'PUBLISHED' ? '📖 Publicar en repositorio' : STATUS_LABELS[nextStatus] || nextStatus}
                  </button>
                ))}
              </div>
              {statusMutation.isSuccess && (
                <p className="text-sm text-green-600 mt-2 flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4" /> Estado actualizado
                </p>
              )}
            </div>
          )}

          {/* Chat asesor-estudiante */}
          <div>
            <h2 className="font-semibold text-gray-900 mb-3">Conversación asesor – estudiante</h2>
            <ChatPanel
              thesisWorkId={id}
              title="Historial de mensajes"
            />
          </div>

          {/* Status history */}
          {work.statusHistory?.length > 0 && (
            <div className="card p-6">
              <h2 className="font-semibold text-gray-900 mb-4">Historial de estados</h2>
              <div className="space-y-3">
                {work.statusHistory.map((h: any) => (
                  <div key={h.id} className="flex gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-unphu-400 mt-1.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{STATUS_LABELS[h.toStatus] || h.toStatus}</p>
                      <p className="text-xs text-gray-400">{formatDate(h.createdAt)}</p>
                      {h.notes && <p className="text-xs text-gray-500 mt-0.5 italic">"{h.notes}"</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: timeline + docs */}
        <div className="space-y-6">
          <div className="card p-5">
            <h3 className="font-semibold text-gray-900 mb-4 text-sm">Progreso del proceso</h3>
            <ProcessTimeline currentStatus={work.status} />
          </div>

          {/* Documents */}
          <div className="card p-5">
            <h3 className="font-semibold text-gray-900 mb-3 text-sm">Documentos adjuntos</h3>
            {(!work.documents || work.documents.length === 0) ? (
              <p className="text-xs text-gray-400 text-center py-4">Sin documentos</p>
            ) : (
              <div className="space-y-2">
                {work.documents.map((doc: any) => (
                  <a
                    key={doc.id}
                    href={doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <span className="text-xs text-gray-700 truncate">{doc.name}</span>
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Reschedule modal */}
      {showRescheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowRescheduleModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                  <CalendarDays className="w-5 h-5 text-purple-600" />
                </div>
                <h2 className="font-bold text-gray-900">Reagendar presentación</h2>
              </div>
              <button onClick={() => setShowRescheduleModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="label">Fecha y hora *</label>
                <input
                  type="datetime-local"
                  value={rescheduleForm.scheduledAt}
                  onChange={(e) => setRescheduleForm((f) => ({ ...f, scheduledAt: e.target.value }))}
                  className="input"
                />
              </div>
              <div>
                <label className="label">Lugar</label>
                <input
                  value={rescheduleForm.location}
                  onChange={(e) => setRescheduleForm((f) => ({ ...f, location: e.target.value }))}
                  className="input"
                  placeholder="Ej: Aula B-204"
                />
              </div>
              <div>
                <label className="label">Enlace virtual</label>
                <input
                  value={rescheduleForm.virtualLink}
                  onChange={(e) => setRescheduleForm((f) => ({ ...f, virtualLink: e.target.value }))}
                  className="input"
                  placeholder="https://meet.google.com/..."
                />
              </div>
              <div>
                <label className="label">Miembros del jurado</label>
                {juradoUsers?.length > 0 ? (
                  <div className="space-y-2">
                    {juradoUsers.map((u: any) => {
                      const name = `${u.firstName} ${u.lastName}`;
                      const selected = rescheduleForm.juryMembers.split(',').map((s: string) => s.trim()).filter(Boolean).includes(name);
                      return (
                        <label key={u.id} className="flex items-center gap-2 text-sm cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => {
                              const current = rescheduleForm.juryMembers.split(',').map((s: string) => s.trim()).filter(Boolean);
                              const updated = selected ? current.filter((n: string) => n !== name) : [...current, name];
                              setRescheduleForm((f) => ({ ...f, juryMembers: updated.join(', ') }));
                            }}
                            className="rounded border-gray-300"
                          />
                          {name}
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <input
                    value={rescheduleForm.juryMembers}
                    onChange={(e) => setRescheduleForm((f) => ({ ...f, juryMembers: e.target.value }))}
                    className="input"
                    placeholder="Dr. García, Ing. Pérez (separados por comas)"
                  />
                )}
              </div>
              {rescheduleMutation.isError && (
                <p className="text-sm text-red-600">Error al reagendar. Intenta de nuevo.</p>
              )}
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200">
              <button onClick={() => setShowRescheduleModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
                Cancelar
              </button>
              <button
                onClick={() => rescheduleMutation.mutate()}
                disabled={!rescheduleForm.scheduledAt || rescheduleMutation.isPending}
                className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center gap-2"
              >
                {rescheduleMutation.isPending ? (
                  <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Guardando...</>
                ) : (
                  <><CalendarDays className="w-4 h-4" /> Guardar cambios</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Publication modal */}
      {showPublishModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h2 className="font-bold text-gray-900 dark:text-white">Publicar en repositorio</h2>
                  <p className="text-xs text-gray-400">Confirma los metadatos antes de publicar</p>
                </div>
              </div>
              <button onClick={() => setShowPublishModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Resumen / Abstract</label>
                <textarea
                  rows={4}
                  value={publishAbstract}
                  onChange={(e) => setPublishAbstract(e.target.value)}
                  className="input text-sm w-full resize-none"
                  placeholder="Resumen del trabajo de grado para el repositorio..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Palabras clave</label>
                <input
                  value={publishKeywords}
                  onChange={(e) => setPublishKeywords(e.target.value)}
                  className="input text-sm w-full"
                  placeholder="metodología, investigación, tecnología (separadas por comas)"
                />
                <p className="text-xs text-gray-400 mt-1">Separadas por comas. Facilitan la búsqueda en el repositorio.</p>
              </div>
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-xs text-amber-700 dark:text-amber-300">
                <strong>Atención:</strong> Una vez publicado, el trabajo aparecerá en el repositorio institucional público y no podrá ocultarse sin contactar al administrador.
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setShowPublishModal(false)}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              >
                Cancelar
              </button>
              <button
                onClick={() => publishMutation.mutate({
                  abstract: publishAbstract,
                  keywords: publishKeywords.split(',').map((k) => k.trim()).filter(Boolean),
                })}
                disabled={publishMutation.isPending}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center gap-2"
              >
                {publishMutation.isPending ? (
                  <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Publicando...</>
                ) : (
                  <><BookOpen className="w-4 h-4" /> Confirmar publicación</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
