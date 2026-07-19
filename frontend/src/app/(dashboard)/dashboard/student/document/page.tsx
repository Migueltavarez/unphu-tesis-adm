'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { studentsApi, thesisDocumentsApi, exportsApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import toast from 'react-hot-toast';
import {
  FileText, ArrowLeft, CheckCircle, Clock, AlertCircle,
  XCircle, Lock, Eye, Edit3, ChevronRight, Download, Printer, FileDown, BookOpen,
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

type DocType = 'THESIS' | 'ANTEPROYECTO';

function flattenNodes(nodes: any[]): any[] {
  const result: any[] = [];
  for (const node of nodes) {
    result.push(node);
    if (node.children?.length) result.push(...flattenNodes(node.children));
  }
  return result;
}

export default function StudentDocumentPage() {
  const { user } = useAuthStore();
  const [exportingDocx, setExportingDocx] = useState(false);
  const [docType, setDocType] = useState<DocType>('THESIS');

  const { data: profile, isLoading: loadingProfile } = useQuery({
    queryKey: ['student-profile'],
    queryFn: studentsApi.myProfile,
    enabled: !!user,
  });

  const activeWork = profile?.thesisWorks?.find(
    (w: any) => !['REJECTED', 'PUBLISHED'].includes(w.status),
  );

  const { data: doc, isLoading: loadingDoc } = useQuery({
    queryKey: ['thesis-document', activeWork?.id, docType],
    queryFn: () => thesisDocumentsApi.getOrCreate(activeWork!.id, docType),
    enabled: !!activeWork,
  });

  const { data: stats } = useQuery({
    queryKey: ['thesis-document-stats', activeWork?.id, docType],
    queryFn: () => thesisDocumentsApi.getStats(activeWork!.id, docType),
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

  const nodes = flattenNodes(doc?.nodes ?? []);
  const requiredNodes = nodes.filter((n: any) => n.isRequired);
  const approvedRequired = requiredNodes.filter((n: any) => n.status === 'APPROVED').length;
  const progress = requiredNodes.length > 0
    ? Math.round((approvedRequired / requiredNodes.length) * 100)
    : 0;

  const pending = nodes.filter((n: any) => n.status === 'RETURNED').length;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/dashboard/student/thesis" className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-gray-900">Documentos de tesis</h1>
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
          >
            <FileDown className="w-3.5 h-3.5" />
            {exportingDocx ? 'Exportando...' : 'Exportar DOCX'}
          </button>
        </div>
      </div>

      {/* Doc type tabs */}
      <div className="flex gap-2">
        {([
          { type: 'THESIS',        label: 'Tesis',          desc: 'Documento final de graduación',         accent: 'unphu' },
          { type: 'ANTEPROYECTO',  label: 'Anteproyecto',   desc: 'Propuesta y planificación del trabajo',  accent: 'amber' },
        ] as { type: DocType; label: string; desc: string; accent: string }[]).map(({ type: dt, label, desc }) => (
          <button
            key={dt}
            onClick={() => setDocType(dt)}
            className={`flex flex-col items-start px-4 py-2.5 rounded-lg border-2 text-left transition-all ${
              docType === dt
                ? dt === 'THESIS'
                  ? 'border-unphu-600 bg-unphu-50 text-unphu-900'
                  : 'border-amber-500 bg-amber-50 text-amber-900'
                : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
            }`}
          >
            <span className="text-sm font-semibold">{label}</span>
            <span className="text-xs opacity-70 mt-0.5">{desc}</span>
          </button>
        ))}
      </div>

      {/* Active doc type banner */}
      {docType === 'ANTEPROYECTO' && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          <BookOpen className="w-4 h-4 flex-shrink-0" />
          <span>Estás viendo el <strong>Anteproyecto</strong> — documento de propuesta previo a la tesis. Las secciones son distintas al documento de Tesis.</span>
        </div>
      )}

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
          <span><span className="font-semibold text-green-600">{approvedRequired}</span> aprobados</span>
          <span><span className="font-semibold text-amber-600">{nodes.filter((n: any) => n.status === 'PENDING_REVIEW').length}</span> en revisión</span>
          {pending > 0 && <span><span className="font-semibold text-red-600">{pending}</span> devueltos</span>}
          <span><span className="font-semibold text-gray-600">{requiredNodes.length}</span> requeridos</span>
        </div>
      </div>

      {/* Nodes list */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
            <BookOpen className="w-4 h-4" />
            {docType === 'THESIS' ? 'Secciones — Tesis' : 'Secciones — Anteproyecto'}
          </h2>
          <span className="text-xs text-gray-400">{nodes.length} secciones</span>
        </div>

        <div className="divide-y divide-gray-50">
          {nodes.map((node: any, i: number) => {
            const isReturned = node.status === 'RETURNED';
            const hasComments = node._count?.comments > 0;
            const minWords = node.metadata?.minWords;

            return (
              <Link
                key={node.id}
                href={`/dashboard/student/document/node/${node.id}`}
                className={`flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors group ${isReturned ? 'bg-red-50 hover:bg-red-50' : ''}`}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold
                  ${node.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
                    node.status === 'RETURNED' ? 'bg-red-100 text-red-700' :
                    'bg-gray-100 text-gray-500'}`}>
                  {i + 1}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-900 truncate">{node.name}</p>
                    {node.isRequired && (
                      <span className="text-xs text-gray-400 flex-shrink-0">Requerido</span>
                    )}
                    {hasComments && (
                      <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-medium flex-shrink-0">
                        {node._count.comments} comentario{node._count.comments !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  {minWords && (
                    <p className="text-xs text-gray-400 mt-0.5">Mínimo {minWords} palabras</p>
                  )}
                </div>

                <div className="flex items-center gap-3 flex-shrink-0">
                  <StatusBadge status={node.status} />
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
