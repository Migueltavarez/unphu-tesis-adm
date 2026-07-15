'use client';
// v2
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { studentsApi, thesisDocumentsApi, exportsApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import toast from 'react-hot-toast';
import {
  FileText, ArrowLeft, CheckCircle, Clock, AlertCircle,
  XCircle, Lock, Eye, Edit3, ChevronRight, Download, Printer, FileDown,
} from 'lucide-react';

const STATUS_META: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  DRAFT:          { label: 'Borrador',        icon: FileText,    color: 'text-gray-500',   bg: 'bg-gray-100'   },
  IN_PROGRESS:    { label: 'En progreso',     icon: Edit3,       color: 'text-blue-600',   bg: 'bg-blue-50'    },
  PENDING_AI:     { label: 'Procesando IA',   icon: Clock,       color: 'text-purple-600', bg: 'bg-purple-50'  },
  PENDING_REVIEW: { label: 'En revisión',     icon: Eye,         color: 'text-amber-600',  bg: 'bg-amber-50'   },
  RETURNED:       { label: 'Devuelto',        icon: AlertCircle, color: 'text-red-600',    bg: 'bg-red-50'     },
  APPROVED:       { label: 'Aprobado',        icon: CheckCircle, color: 'text-green-600',  bg: 'bg-green-50'   },
  BLOCKED:        { label: 'Bloqueado',       icon: Lock,        color: 'text-gray-600',   bg: 'bg-gray-100'   },
  PUBLISHED:      { label: 'Publicado',       icon: CheckCircle, color: 'text-emerald-600',bg: 'bg-emerald-50' },
  ARCHIVED:       { label: 'Archivado',       icon: XCircle,     color: 'text-gray-400',   bg: 'bg-gray-50'    },
};

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? STATUS_META.DRAFT;
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${meta.bg} ${meta.color}`}>
      <Icon className="w-3 h-3" />
      {meta.label}
    </span>
  );
}

export default function StudentDocumentPage() {
  const { user } = useAuthStore();
  const [exportingDocx, setExportingDocx] = useState(false);

  const { data: profile, isLoading: loadingProfile } = useQuery({
    queryKey: ['student-profile'],
    queryFn: studentsApi.myProfile,
    enabled: !!user,
  });

  const activeWork = profile?.thesisWorks?.find(
    (w: any) => !['REJECTED', 'PUBLISHED'].includes(w.status),
  );

  const { data: doc, isLoading: loadingDoc } = useQuery({
    queryKey: ['thesis-document', activeWork?.id],
    queryFn: () => thesisDocumentsApi.getOrCreate(activeWork!.id),
    enabled: !!activeWork,
  });

  const { data: stats } = useQuery({
    queryKey: ['thesis-document-stats', activeWork?.id],
    queryFn: () => thesisDocumentsApi.getStats(activeWork!.id),
    enabled: !!activeWork,
  });

  const isLoading = loadingProfile || loadingDoc;

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin w-8 h-8 border-2 border-unphu-600 border-t-transparent rounded-full" />
    </div>
  );

  if (!activeWork) return (
    <div className="max-w-xl mx-auto">
      <div className="card p-8 text-center">
        <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-gray-900 mb-2">Sin trabajo activo</h2>
        <p className="text-sm text-gray-500 mb-4">Inicia tu postulación desde el panel principal.</p>
        <Link href="/dashboard/student" className="btn-secondary text-sm inline-flex items-center gap-1.5">
          <ArrowLeft className="w-4 h-4" /> Volver al inicio
        </Link>
      </div>
    </div>
  );

  const sections = doc?.sections ?? [];
  const requiredSections = sections.filter((s: any) => s.isRequired);
  const approvedRequired = requiredSections.filter((s: any) => s.status === 'APPROVED').length;
  const progress = requiredSections.length > 0
    ? Math.round((approvedRequired / requiredSections.length) * 100)
    : 0;

  const pending = sections.filter((s: any) => s.status === 'RETURNED').length;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/dashboard/student/thesis" className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-gray-900">Documento de tesis</h1>
          <p className="text-gray-500 text-sm truncate">{activeWork.title}</p>
        </div>

        {/* Export buttons */}
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={() => window.open('/dashboard/student/document/print', '_blank')}
            className="btn-secondary text-sm py-1.5 inline-flex items-center gap-1.5"
            title="Abrir vista de impresión para exportar como PDF"
          >
            <Printer className="w-3.5 h-3.5" />
            Imprimir / PDF
          </button>
          <button
            onClick={async () => {
              setExportingDocx(true);
              try {
                await exportsApi.downloadDocx(activeWork.id);
                toast.success('Documento DOCX descargado');
              } catch {
                toast.error('Error al exportar. Asegúrate de haber abierto el editor primero.');
              } finally {
                setExportingDocx(false);
              }
            }}
            disabled={exportingDocx}
            className="btn-secondary text-sm py-1.5 inline-flex items-center gap-1.5"
            title="Descargar como archivo Word (.docx)"
          >
            <FileDown className="w-3.5 h-3.5" />
            {exportingDocx ? 'Exportando...' : 'Exportar DOCX'}
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-gray-700">Progreso general</span>
          <span className="text-sm font-bold text-unphu-700">{progress}%</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2.5 mb-3">
          <div
            className="bg-unphu-600 h-2.5 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex gap-4 text-xs text-gray-500">
          <span><span className="font-semibold text-green-600">{approvedRequired}</span> aprobadas</span>
          <span><span className="font-semibold text-amber-600">{sections.filter((s: any) => s.status === 'PENDING_REVIEW').length}</span> en revisión</span>
          {pending > 0 && <span><span className="font-semibold text-red-600">{pending}</span> devueltas</span>}
          <span><span className="font-semibold text-gray-600">{requiredSections.length}</span> requeridas</span>
        </div>
      </div>

      {/* Sections list */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900 text-sm">Secciones del documento</h2>
          <span className="text-xs text-gray-400">{sections.length} secciones</span>
        </div>

        <div className="divide-y divide-gray-50">
          {sections.map((section: any, i: number) => {
            const meta = STATUS_META[section.status] ?? STATUS_META.DRAFT;
            const Icon = meta.icon;
            const hasComments = section._count?.comments > 0;
            const isReturned = section.status === 'RETURNED';
            const isEditable = ['DRAFT', 'IN_PROGRESS', 'RETURNED'].includes(section.status);

            return (
              <Link
                key={section.id}
                href={`/dashboard/student/document/${section.id}`}
                className={`flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors group ${isReturned ? 'bg-red-50 hover:bg-red-50' : ''}`}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold
                  ${section.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
                    section.status === 'RETURNED' ? 'bg-red-100 text-red-700' :
                    'bg-gray-100 text-gray-500'}`}>
                  {i + 1}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-900 truncate">{section.title}</p>
                    {section.isRequired && (
                      <span className="text-xs text-gray-400 flex-shrink-0">Requerida</span>
                    )}
                    {hasComments && (
                      <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-medium flex-shrink-0">
                        {section._count.comments} comentario{section._count.comments !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  {section.minWords && (
                    <p className="text-xs text-gray-400 mt-0.5">Mínimo {section.minWords} palabras</p>
                  )}
                </div>

                <div className="flex items-center gap-3 flex-shrink-0">
                  <StatusBadge status={section.status} />
                  <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
