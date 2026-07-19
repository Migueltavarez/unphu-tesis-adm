'use client';
import { useState, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { documentNodesApi, blocksApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { formatDate } from '@/lib/utils';
import dynamic from 'next/dynamic';
import toast from 'react-hot-toast';
import { ArrowLeft, CheckCircle, RotateCcw, MessageSquare, History, ChevronDown, ChevronUp } from 'lucide-react';

const BlockEditor = dynamic(() => import('@/components/editor/BlockEditor'), { ssr: false });

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Borrador', IN_PROGRESS: 'En progreso', PENDING_AI: 'Procesando IA',
  PENDING_REVIEW: 'En revisión', RETURNED: 'Devuelto', APPROVED: 'Aprobado',
  BLOCKED: 'Bloqueado', PUBLISHED: 'Publicado', ARCHIVED: 'Archivado',
};

const STATUS_COLOR: Record<string, string> = {
  PENDING_REVIEW: 'bg-amber-50 text-amber-700 border-amber-200',
  APPROVED: 'bg-green-50 text-green-700 border-green-200',
  RETURNED: 'bg-red-50 text-red-700 border-red-200',
  IN_PROGRESS: 'bg-blue-50 text-blue-700 border-blue-200',
};

export default function AdvisorReviewPage() {
  const { sectionId: nodeId } = useParams<{ sectionId: string }>();
  const { user } = useAuthStore();
  const qc = useQueryClient();

  const [action, setAction] = useState<'approve' | 'return' | null>(null);
  const [notes, setNotes] = useState('');
  const [newComment, setNewComment] = useState('');
  const [showHistory, setShowHistory] = useState(false);

  const { data: node, isLoading } = useQuery({
    queryKey: ['document-node', nodeId],
    queryFn: () => documentNodesApi.get(nodeId),
    enabled: !!nodeId,
  });

  const primaryBlock = node?.blocks?.[0];

  const approveMutation = useMutation({
    mutationFn: () => documentNodesApi.approve(nodeId, notes || undefined),
    onSuccess: () => {
      toast.success('Sección aprobada');
      setAction(null);
      setNotes('');
      qc.invalidateQueries({ queryKey: ['document-node', nodeId] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Error al aprobar'),
  });

  const returnMutation = useMutation({
    mutationFn: () => documentNodesApi.returnNode(nodeId, notes || undefined),
    onSuccess: () => {
      toast.success('Sección devuelta al estudiante');
      setAction(null);
      setNotes('');
      qc.invalidateQueries({ queryKey: ['document-node', nodeId] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Error al devolver'),
  });

  const addCommentMutation = useMutation({
    mutationFn: () => documentNodesApi.addComment(nodeId, { content: newComment }),
    onSuccess: () => {
      toast.success('Comentario agregado');
      setNewComment('');
      qc.invalidateQueries({ queryKey: ['document-node', nodeId] });
    },
  });

  const resolveCommentMutation = useMutation({
    mutationFn: (commentId: string) => documentNodesApi.resolveComment(commentId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['document-node', nodeId] }),
  });

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin w-7 h-7 border-2 border-unphu-600 border-t-transparent rounded-full" />
    </div>
  );

  if (!node) return null;

  const status = node.status as string;
  const canReview = status === 'PENDING_REVIEW';
  const minWords = node.metadata?.minWords as number | undefined;
  const activeComments = node.comments?.filter((c: any) => !c.resolved) ?? [];
  const history = node.history ?? [];

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/dashboard/advisor/works" className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-gray-900 truncate">
              Revisando: {node.name}
            </h1>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${STATUS_COLOR[status] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
              {STATUS_LABELS[status] ?? status}
            </span>
          </div>
          {minWords && (
            <p className="text-xs text-gray-400 mt-0.5">Mínimo requerido: {minWords} palabras</p>
          )}
        </div>

        {/* Review actions */}
        {canReview && (
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={() => setAction(action === 'return' ? null : 'return')}
              className={`text-sm py-1.5 px-3 rounded-lg border font-medium inline-flex items-center gap-1.5 transition-colors
                ${action === 'return' ? 'bg-red-600 text-white border-red-600' : 'border-red-200 text-red-600 hover:bg-red-50'}`}
            >
              <RotateCcw className="w-3.5 h-3.5" /> Devolver
            </button>
            <button
              onClick={() => setAction(action === 'approve' ? null : 'approve')}
              className={`text-sm py-1.5 px-3 rounded-lg border font-medium inline-flex items-center gap-1.5 transition-colors
                ${action === 'approve' ? 'bg-green-600 text-white border-green-600' : 'border-green-200 text-green-600 hover:bg-green-50'}`}
            >
              <CheckCircle className="w-3.5 h-3.5" /> Aprobar
            </button>
          </div>
        )}
      </div>

      {/* Action panel */}
      {action && (
        <div className={`card p-4 border-2 ${action === 'approve' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
          <h3 className={`font-semibold text-sm mb-2 ${action === 'approve' ? 'text-green-800' : 'text-red-800'}`}>
            {action === 'approve' ? '✓ Aprobar sección' : '↩ Devolver con notas'}
          </h3>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={action === 'approve'
              ? 'Comentario opcional para el estudiante...'
              : 'Indica qué debe corregir el estudiante (requerido para devolver)...'}
            className="input w-full text-sm resize-none"
            rows={3}
          />
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => action === 'approve' ? approveMutation.mutate() : returnMutation.mutate()}
              disabled={
                (action === 'return' && !notes.trim()) ||
                approveMutation.isPending || returnMutation.isPending
              }
              className={`text-sm py-1.5 px-4 rounded-lg font-medium text-white
                ${action === 'approve' ? 'bg-green-600 hover:bg-green-700 disabled:bg-green-300' : 'bg-red-600 hover:bg-red-700 disabled:bg-red-300'}`}
            >
              {approveMutation.isPending || returnMutation.isPending ? 'Guardando...' :
                action === 'approve' ? 'Confirmar aprobación' : 'Confirmar devolución'}
            </button>
            <button onClick={() => { setAction(null); setNotes(''); }} className="btn-secondary text-sm py-1.5">
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Read-only editor */}
        <div className="lg:col-span-2">
          <div className="card overflow-hidden">
            <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Contenido de la sección</p>
              <p className="text-xs text-gray-400">Solo lectura</p>
            </div>
            <BlockEditor
              content={primaryBlock?.content ?? null}
              onChange={() => {}}
              readOnly={true}
              placeholder="El estudiante aún no ha escrito contenido en esta sección."
              blockId={primaryBlock?.id}
              currentUser={user ? { name: `${user.firstName} ${user.lastName}`, color: '#9333ea' } : undefined}
            />
          </div>
        </div>

        {/* Comments + History */}
        <div className="space-y-4">
          {/* Add comment */}
          <div className="card p-4">
            <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2 mb-3">
              <MessageSquare className="w-4 h-4" />
              Comentarios
              {activeComments.length > 0 && (
                <span className="bg-red-500 text-white text-xs rounded-full px-1.5">{activeComments.length}</span>
              )}
            </h3>

            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Escribe una observación para el estudiante..."
              className="input w-full text-sm resize-none"
              rows={3}
            />
            <button
              onClick={() => addCommentMutation.mutate()}
              disabled={!newComment.trim() || addCommentMutation.isPending}
              className="btn-primary text-xs py-1.5 mt-1.5 w-full"
            >
              Agregar comentario
            </button>

            {activeComments.length > 0 && (
              <div className="mt-3 space-y-2">
                {activeComments.map((c: any) => (
                  <div key={c.id} className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-gray-800">{c.authorName}</span>
                      <button
                        onClick={() => resolveCommentMutation.mutate(c.id)}
                        className="text-green-600 hover:text-green-700 font-medium"
                      >
                        Resolver ✓
                      </button>
                    </div>
                    <p className="text-gray-700 mt-1">{c.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* History */}
          <div className="card p-4">
            <button onClick={() => setShowHistory(!showHistory)} className="flex items-center justify-between w-full">
              <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
                <History className="w-4 h-4" />
                Historial
              </h3>
              {showHistory ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </button>

            {showHistory && (
              <div className="mt-3 space-y-2.5">
                {history.length === 0 ? (
                  <p className="text-xs text-gray-400">Sin historial todavía</p>
                ) : (
                  history.map((h: any) => (
                    <div key={h.id} className="flex gap-2 text-xs">
                      <div className="w-1.5 h-1.5 rounded-full bg-unphu-400 mt-1.5 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-gray-800">{STATUS_LABELS[h.toStatus] ?? h.toStatus}</p>
                        <p className="text-gray-400">{formatDate(h.createdAt)}</p>
                        {h.notes && <p className="text-gray-500 italic">"{h.notes}"</p>}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
