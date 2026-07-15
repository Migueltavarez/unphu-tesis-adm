'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { studentsApi, advancesApi, documentsApi, meetingsApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { formatDate, formatFileSize, STATUS_LABELS } from '@/lib/utils';
import StatusBadge from '@/components/ui/StatusBadge';
import ProcessTimeline from '@/components/ui/ProcessTimeline';
import ChatPanel from '@/components/ui/ChatPanel';
import { FileText, Upload, Download, Clock, User, ArrowLeft, Plus, Calendar, MapPin, Star, CheckCircle2, XCircle } from 'lucide-react';

function DefenseCard({ presentation, status }: { presentation: any; status: string }) {
  const avgGrade = presentation.grades?.length > 0
    ? presentation.grades.reduce((sum: number, g: any) => sum + (g.finalGrade ?? 0), 0) / presentation.grades.length
    : null;
  const approved = status === 'APPROVED';
  const rejected = status === 'REJECTED';
  const isScheduled = status === 'PRESENTATION_SCHEDULED';

  return (
    <div className={`card p-6 border-2 ${approved ? 'border-green-200 bg-green-50 dark:bg-green-900/10 dark:border-green-800' : rejected ? 'border-red-200 bg-red-50 dark:bg-red-900/10 dark:border-red-800' : 'border-violet-200 bg-violet-50 dark:bg-violet-900/10 dark:border-violet-800'}`}>
      <div className="flex items-center gap-3 mb-4">
        {approved ? (
          <CheckCircle2 className="w-5 h-5 text-green-600" />
        ) : rejected ? (
          <XCircle className="w-5 h-5 text-red-600" />
        ) : (
          <Calendar className="w-5 h-5 text-violet-600" />
        )}
        <h3 className={`font-semibold ${approved ? 'text-green-800 dark:text-green-300' : rejected ? 'text-red-800 dark:text-red-300' : 'text-violet-800 dark:text-violet-300'}`}>
          {approved ? 'Trabajo aprobado' : rejected ? 'Trabajo rechazado' : isScheduled ? 'Defensa programada' : 'Defensa realizada'}
        </h3>
      </div>

      <div className="grid sm:grid-cols-2 gap-3 mb-4">
        <div className="flex items-start gap-2">
          <Calendar className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-xs text-gray-500">Fecha de defensa</p>
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              {new Date(presentation.scheduledAt).toLocaleDateString('es-DO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
            <p className="text-xs text-gray-400">
              {new Date(presentation.scheduledAt).toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>

        {(presentation.location || presentation.virtualLink) && (
          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-gray-500">Lugar</p>
              {presentation.location && <p className="text-sm font-medium text-gray-900 dark:text-white">{presentation.location}</p>}
              {presentation.virtualLink && (
                <a href={presentation.virtualLink} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">
                  Enlace virtual
                </a>
              )}
            </div>
          </div>
        )}
      </div>

      {presentation.juryMembers?.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-medium text-gray-500 mb-2">Jurado</p>
          <div className="flex flex-wrap gap-2">
            {presentation.juryMembers.map((name: string, i: number) => (
              <span key={i} className="flex items-center gap-1.5 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full px-3 py-1 text-gray-700 dark:text-gray-300">
                <User className="w-3 h-3 text-gray-400" />
                {name}
              </span>
            ))}
          </div>
        </div>
      )}

      {presentation.grades?.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-500 mb-2">Calificaciones</p>
          <div className="space-y-2">
            {presentation.grades.map((grade: any) => (
              <div key={grade.id} className="flex items-center gap-3 bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-100 dark:border-gray-700">
                <div className="flex-1">
                  <p className="text-xs font-medium text-gray-700 dark:text-gray-300">{grade.evaluatorName}</p>
                  {grade.observations && <p className="text-xs text-gray-400 mt-0.5">{grade.observations}</p>}
                </div>
                <div className="text-right shrink-0">
                  {grade.finalGrade != null && (
                    <span className={`text-lg font-bold ${grade.finalGrade >= 70 ? 'text-green-600' : 'text-red-600'}`}>
                      {grade.finalGrade}
                    </span>
                  )}
                  {grade.writtenGrade != null && grade.oralGrade != null && (
                    <p className="text-xs text-gray-400">Escrito: {grade.writtenGrade} · Oral: {grade.oralGrade}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
          {avgGrade != null && (
            <div className={`mt-3 text-center p-3 rounded-lg ${avgGrade >= 70 ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
              <span className={`text-2xl font-bold ${avgGrade >= 70 ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                {Math.round(avgGrade * 10) / 10}
              </span>
              <p className={`text-xs mt-0.5 ${avgGrade >= 70 ? 'text-green-600' : 'text-red-600'}`}>
                Promedio final · {avgGrade >= 70 ? 'Aprobado' : 'No aprobado'}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function StudentThesisPage() {
  const { user } = useAuthStore();

  const { data: profile, isLoading } = useQuery({
    queryKey: ['student-profile'],
    queryFn: studentsApi.myProfile,
    enabled: !!user,
  });

  const activeWork = profile?.thesisWorks?.find(
    (w: any) => !['REJECTED', 'PUBLISHED'].includes(w.status),
  );

  const { data: meetings = [] } = useQuery({
    queryKey: ['student-meetings', activeWork?.id],
    queryFn: () => meetingsApi.list(activeWork!.id),
    enabled: !!activeWork?.id,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-unphu-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!activeWork) {
    return (
      <div className="max-w-xl mx-auto">
        <div className="card p-8 text-center">
          <FileText className="w-14 h-14 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Sin trabajo de grado activo</h2>
          <p className="text-gray-500 mb-6 text-sm">
            No tienes un trabajo de grado en proceso. Inicia tu postulación desde el panel principal.
          </p>
          <Link href="/dashboard/student" className="btn-secondary inline-flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" /> Volver al inicio
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/student" className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mi trabajo de grado</h1>
          <p className="text-gray-500 text-sm">{activeWork.career?.name}</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Work card */}
          <div className="card p-6 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-bold text-gray-900 text-lg">{activeWork.title}</h2>
                <p className="text-sm text-gray-500 mt-1">
                  {activeWork.type === 'TESIS' ? 'Tesis' : 'Monográfico'} · {activeWork.year}
                </p>
              </div>
              <StatusBadge status={activeWork.status} />
            </div>

            {activeWork.abstract && (
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Resumen</p>
                <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">{activeWork.abstract}</p>
              </div>
            )}

            {activeWork.keywords?.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Palabras clave</p>
                <div className="flex flex-wrap gap-2">
                  {activeWork.keywords.map((kw: string) => (
                    <span key={kw} className="badge bg-unphu-50 text-unphu-700">{kw}</span>
                  ))}
                </div>
              </div>
            )}

            {activeWork.advisor && (
              <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold">
                  {activeWork.advisor.user?.firstName?.[0]}{activeWork.advisor.user?.lastName?.[0]}
                </div>
                <div>
                  <p className="text-xs text-gray-500">Asesor asignado</p>
                  <p className="text-sm font-medium text-gray-900">
                    {activeWork.advisor.user?.firstName} {activeWork.advisor.user?.lastName}
                  </p>
                  {activeWork.advisor.user?.email && (
                    <p className="text-xs text-gray-400">{activeWork.advisor.user.email}</p>
                  )}
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-2 border-t border-gray-100">
              <Link href="/dashboard/student/advances" className="btn-primary text-sm py-1.5 inline-flex items-center gap-1.5">
                <Upload className="w-3.5 h-3.5" /> Enviar avance
              </Link>
            </div>
          </div>

          {/* Defense & grade card */}
          {(['PRESENTATION_SCHEDULED', 'PRESENTATION_DONE', 'GRADED', 'APPROVED', 'REJECTED'] as string[]).includes(activeWork.status) && activeWork.presentation && (
            <DefenseCard presentation={activeWork.presentation} status={activeWork.status} />
          )}

          {/* Avances */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Avances enviados</h3>
              <Link href="/dashboard/student/advances" className="btn-primary text-xs py-1 px-3 inline-flex items-center gap-1">
                <Plus className="w-3 h-3" /> Nuevo avance
              </Link>
            </div>
            {(!activeWork.advances || activeWork.advances.length === 0) ? (
              <div className="text-center py-8 text-gray-400">
                <Clock className="w-8 h-8 mx-auto mb-2" />
                <p className="text-sm">No has enviado avances todavía</p>
              </div>
            ) : (
              <div className="space-y-3">
                {activeWork.advances.map((adv: any) => (
                  <div key={adv.id} className="flex items-center gap-3 p-3 border border-gray-100 rounded-lg">
                    <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center flex-shrink-0">
                      <Upload className="w-3.5 h-3.5 text-teal-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{adv.title}</p>
                      <p className="text-xs text-gray-400">{formatDate(adv.createdAt)}</p>
                    </div>
                    <span className={`badge text-xs ${
                      adv.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
                      adv.status === 'NEEDS_REVISION' ? 'bg-orange-100 text-orange-700' :
                      adv.status === 'UNDER_REVIEW' ? 'bg-blue-100 text-blue-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {adv.status === 'APPROVED' ? 'Aprobado' :
                       adv.status === 'NEEDS_REVISION' ? 'Revisar' :
                       adv.status === 'UNDER_REVIEW' ? 'En revisión' : 'Enviado'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Documentos */}
          <div className="card p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Documentos</h3>
            {(!activeWork.documents || activeWork.documents.length === 0) ? (
              <div className="text-center py-6 text-gray-400">
                <FileText className="w-8 h-8 mx-auto mb-2" />
                <p className="text-sm">No hay documentos adjuntos</p>
              </div>
            ) : (
              <div className="space-y-2">
                {activeWork.documents.map((doc: any) => (
                  <div key={doc.id} className="flex items-center gap-3 p-3 border border-gray-100 rounded-lg">
                    <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900 truncate">{doc.name}</p>
                      <p className="text-xs text-gray-400">{doc.type} · {formatFileSize(doc.fileSize)}</p>
                    </div>
                    {doc.url && (
                      <a href={doc.url} target="_blank" rel="noopener noreferrer" className="text-unphu-600 hover:text-unphu-700">
                        <Download className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Chat con el asesor */}
          {activeWork.advisor && (
            <ChatPanel
              thesisWorkId={activeWork.id}
              title={`Chat con ${activeWork.advisor.user?.firstName ?? 'el asesor'} ${activeWork.advisor.user?.lastName ?? ''}`}
            />
          )}
          {!activeWork.advisor && (
            <div className="card p-5 text-center text-gray-400 border-dashed">
              <p className="text-sm">El chat estará disponible una vez que se te asigne un asesor.</p>
            </div>
          )}
        </div>

        {/* Timeline */}
        <div className="space-y-6">
          <div className="card p-5">
            <h3 className="font-semibold text-gray-900 mb-4 text-sm">Progreso del proceso</h3>
            <ProcessTimeline currentStatus={activeWork.status} />
          </div>

          {/* Próximas reuniones */}
          {(meetings as any[]).length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-5 py-3.5 border-b border-gray-100">
                <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-unphu-600" />
                  Reuniones con el asesor
                </h3>
              </div>
              <div className="divide-y divide-gray-50">
                {(meetings as any[])
                  .filter((m: any) => !m.completed)
                  .slice(0, 3)
                  .map((m: any) => (
                    <div key={m.id} className="px-5 py-3 space-y-1">
                      <p className="text-xs font-medium text-gray-900">
                        {new Date(m.scheduledAt).toLocaleString('es-DO', { dateStyle: 'medium', timeStyle: 'short' })}
                      </p>
                      {m.location && (
                        <p className="text-xs text-gray-500 flex items-center gap-1">
                          <MapPin className="w-2.5 h-2.5 flex-shrink-0" /> {m.location}
                        </p>
                      )}
                      {m.agenda && (
                        <p className="text-xs text-gray-400 line-clamp-1">{m.agenda}</p>
                      )}
                    </div>
                  ))}
                {(meetings as any[]).filter((m: any) => !m.completed).length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-4">No hay reuniones pendientes</p>
                )}
              </div>
            </div>
          )}

          {/* Historial de estados */}
          {activeWork.statusHistory?.length > 0 && (
            <div className="card p-5">
              <h3 className="font-semibold text-gray-900 mb-4 text-sm">Historial de cambios</h3>
              <div className="space-y-3">
                {activeWork.statusHistory.slice(0, 6).map((h: any) => (
                  <div key={h.id} className="flex gap-2.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-unphu-400 mt-1.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-gray-900">{STATUS_LABELS[h.toStatus] || h.toStatus}</p>
                      <p className="text-xs text-gray-400">{formatDate(h.createdAt)}</p>
                      {h.notes && <p className="text-xs text-gray-500 mt-0.5">{h.notes}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
