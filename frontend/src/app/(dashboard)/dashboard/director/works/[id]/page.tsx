'use client';
import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { thesisApi } from '@/lib/api';
import { formatDate, STATUS_LABELS } from '@/lib/utils';
import StatusBadge from '@/components/ui/StatusBadge';
import ProcessTimeline from '@/components/ui/ProcessTimeline';
import { ArrowLeft, User, FileText, GraduationCap, Upload, CheckCircle, RotateCcw } from 'lucide-react';

export default function DirectorWorkDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState('');

  const { data: work, isLoading } = useQuery({
    queryKey: ['director-work', id],
    queryFn: () => thesisApi.getById(id),
    enabled: !!id,
  });

  const approveDraftMutation = useMutation({
    mutationFn: () => thesisApi.updateStatus(id, 'DRAFT_APPROVED', notes || 'Anteproyecto revisado y aprobado por Dirección Académica'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['director-work', id] });
      setNotes('');
    },
  });

  const requestChangesMutation = useMutation({
    mutationFn: () => thesisApi.updateStatus(id, 'DRAFT_IN_PROGRESS', notes || 'Dirección solicita correcciones al anteproyecto'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['director-work', id] });
      setNotes('');
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
        <Link href="/dashboard/director/works" className="btn-secondary mt-4 inline-flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" /> Volver
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-start gap-3">
        <Link href="/dashboard/director/works" className="text-gray-400 hover:text-gray-600 mt-1">
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

      {/* Revisión del anteproyecto (solo Dirección, cuando corresponde) */}
      {work.status === 'DRAFT_UNDER_REVIEW' && (
        <div className="card p-6 border-l-4 border-amber-400">
          <h2 className="font-semibold text-gray-900 mb-2">Revisar anteproyecto</h2>
          <p className="text-sm text-gray-500 mb-4">
            El estudiante completó el anteproyecto. Apruébalo para continuar con la asignación de asesor, o solicita correcciones si necesita ajustes.
          </p>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="input text-sm mb-3"
            rows={2}
            placeholder="Observaciones (opcional)..."
          />
          <div className="flex gap-3">
            <button
              onClick={() => approveDraftMutation.mutate()}
              disabled={approveDraftMutation.isPending || requestChangesMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg disabled:opacity-50"
            >
              <CheckCircle className="w-4 h-4" />
              {approveDraftMutation.isPending ? 'Guardando...' : 'Aprobar anteproyecto'}
            </button>
            <button
              onClick={() => requestChangesMutation.mutate()}
              disabled={approveDraftMutation.isPending || requestChangesMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-lg disabled:opacity-50"
            >
              <RotateCcw className="w-4 h-4" />
              {requestChangesMutation.isPending ? 'Guardando...' : 'Solicitar correcciones'}
            </button>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Student */}
          <div className="card p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Estudiante</h2>
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

          {/* Advisor */}
          {work.advisor && (
            <div className="card p-6">
              <h2 className="font-semibold text-gray-900 mb-4">Asesor</h2>
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
            </div>
          )}

          {/* Abstract */}
          {work.abstract && (
            <div className="card p-6">
              <h2 className="font-semibold text-gray-900 mb-3">Resumen</h2>
              <p className="text-sm text-gray-600 leading-relaxed">{work.abstract}</p>
              {work.keywords?.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {work.keywords.map((kw: string) => (
                    <span key={kw} className="badge bg-unphu-50 text-unphu-700">{kw}</span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Avances summary */}
          {work.advances?.length > 0 && (
            <div className="card p-6">
              <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Upload className="w-4 h-4" /> Avances ({work.advances.length})
              </h2>
              <div className="space-y-2">
                {work.advances.map((adv: any) => (
                  <div key={adv.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{adv.title}</p>
                      <p className="text-xs text-gray-400">{formatDate(adv.createdAt)}</p>
                    </div>
                    <span className={`badge text-xs ${
                      adv.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
                      adv.status === 'REJECTED' ? 'bg-red-100 text-red-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {adv.status === 'APPROVED' ? 'Aprobado' : adv.status === 'REJECTED' ? 'Rechazado' : 'Pendiente'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

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

        <div className="space-y-6">
          <div className="card p-5">
            <h3 className="font-semibold text-gray-900 mb-4 text-sm">Progreso del proceso</h3>
            <ProcessTimeline currentStatus={work.status} />
          </div>

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
                <span className="text-gray-900 text-right">{work.career?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Avances</span>
                <span className="text-gray-900">{work.advances?.length ?? 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Documentos</span>
                <span className="text-gray-900">{work.documents?.length ?? 0}</span>
              </div>
            </div>
          </div>

          {/* Documents */}
          {work.documents?.length > 0 && (
            <div className="card p-5">
              <h3 className="font-semibold text-gray-900 mb-3 text-sm">Documentos</h3>
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
