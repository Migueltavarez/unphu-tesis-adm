'use client';
import { useState, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sectionsApi, blocksApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { formatDate } from '@/lib/utils';
import dynamic from 'next/dynamic';
import toast from 'react-hot-toast';
import {
  ArrowLeft, Send, CheckCircle, AlertCircle,
  History, MessageSquare, ChevronDown, ChevronUp, Sparkles, X,
  Lightbulb, FileEdit, BookOpen, List, BookMarked,
} from 'lucide-react';

const BlockEditor = dynamic(() => import('@/components/editor/BlockEditor'), { ssr: false });

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Borrador', IN_PROGRESS: 'En progreso', PENDING_AI: 'Procesando IA',
  PENDING_REVIEW: 'En revisión', RETURNED: 'Devuelto', APPROVED: 'Aprobado',
  BLOCKED: 'Bloqueado', PUBLISHED: 'Publicado', ARCHIVED: 'Archivado',
};

const STATUS_COLOR: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  IN_PROGRESS: 'bg-blue-50 text-blue-700',
  PENDING_REVIEW: 'bg-amber-50 text-amber-700',
  RETURNED: 'bg-red-50 text-red-700',
  APPROVED: 'bg-green-50 text-green-700',
  BLOCKED: 'bg-gray-100 text-gray-600',
  PUBLISHED: 'bg-emerald-50 text-emerald-700',
};

function CommentBubble({ comment, onResolve }: { comment: any; onResolve: (id: string) => void }) {
  const [showReplies, setShowReplies] = useState(false);
  return (
    <div className={`border rounded-lg p-3 ${comment.resolved ? 'border-green-100 bg-green-50 opacity-60' : 'border-amber-200 bg-amber-50'}`}>
      <div className="flex items-start gap-2">
        <div className="w-7 h-7 rounded-full bg-amber-200 flex items-center justify-center text-xs font-bold text-amber-800 flex-shrink-0">
          {comment.authorName?.[0] ?? '?'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-900">{comment.authorName}</span>
            <span className="text-xs text-gray-400">{formatDate(comment.createdAt)}</span>
            {!comment.resolved && (
              <button onClick={() => onResolve(comment.id)} className="ml-auto text-xs text-green-600 hover:text-green-700 font-medium">
                Resolver ✓
              </button>
            )}
          </div>
          <p className="text-sm text-gray-700 mt-0.5">{comment.content}</p>
        </div>
      </div>
      {comment.replies?.length > 0 && (
        <button className="text-xs text-gray-400 mt-2 ml-9" onClick={() => setShowReplies(!showReplies)}>
          {showReplies ? 'Ocultar' : `Ver ${comment.replies.length} respuesta(s)`}
        </button>
      )}
      {showReplies && comment.replies?.map((r: any) => (
        <div key={r.id} className="ml-9 mt-2 text-xs text-gray-600 border-l-2 border-gray-200 pl-2">
          <span className="font-medium">{r.authorName}:</span> {r.content}
        </div>
      ))}
    </div>
  );
}

export default function SectionEditorPage() {
  const { sectionId } = useParams<{ sectionId: string }>();
  const { user } = useAuthStore();
  const qc = useQueryClient();

  const [submitNotes, setSubmitNotes] = useState('');
  const [showSubmitPanel, setShowSubmitPanel] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [showCommentBox, setShowCommentBox] = useState(false);
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [aiResult, setAiResult] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAction, setAiAction] = useState<string>('');
  const pendingContent = useRef<{ content: Record<string, any>; wordCount: number } | null>(null);

  const AI_ACTIONS = [
    { id: 'suggest', label: 'Sugerencias', icon: Lightbulb, desc: 'Ideas para completar esta sección' },
    { id: 'improve', label: 'Mejorar texto', icon: FileEdit, desc: 'Reescribe con estilo académico' },
    { id: 'summarize', label: 'Resumir', icon: BookOpen, desc: 'Genera un resumen del contenido' },
    { id: 'outline', label: 'Esquema', icon: List, desc: 'Estructura sugerida para la sección' },
    { id: 'references', label: 'Referencias', icon: BookMarked, desc: 'Fuentes académicas recomendadas' },
  ] as const;

  const runAi = async (action: string) => {
    if (!sectionId) return;
    setAiAction(action);
    setAiResult('');
    setAiLoading(true);

    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
    const token = document.cookie.match(/accessToken=([^;]+)/)?.[1] ?? '';

    try {
      const res = await fetch(`${API_URL}/sections/${sectionId}/ai/${action}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok || !res.body) throw new Error('Error al conectar con AI');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          if (data === '[DONE]') break;
          try {
            const { text } = JSON.parse(data);
            setAiResult((prev) => prev + text);
          } catch {}
        }
      }
    } catch (err: any) {
      setAiResult(`Error: ${err.message}`);
    } finally {
      setAiLoading(false);
    }
  };

  const { data: section, isLoading } = useQuery({
    queryKey: ['section', sectionId],
    queryFn: () => sectionsApi.get(sectionId),
    enabled: !!sectionId,
  });

  // Blocks for this section (we use blocks[0] as the main content block)
  const primaryBlock = section?.blocks?.[0];

  const updateBlockMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => blocksApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['section', sectionId] }),
  });

  const createBlockMutation = useMutation({
    mutationFn: (data: any) => blocksApi.create(sectionId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['section', sectionId] }),
  });

  const saveVersionMutation = useMutation({
    mutationFn: (message: string) => blocksApi.saveVersion(primaryBlock?.id, message),
    onSuccess: () => toast.success('Versión guardada'),
  });

  const submitMutation = useMutation({
    mutationFn: () => sectionsApi.submit(sectionId, submitNotes || undefined),
    onSuccess: () => {
      toast.success('Sección enviada a revisión');
      setShowSubmitPanel(false);
      qc.invalidateQueries({ queryKey: ['section', sectionId] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Error al enviar'),
  });

  const addCommentMutation = useMutation({
    mutationFn: () => sectionsApi.addComment(sectionId, { content: newComment }),
    onSuccess: () => {
      toast.success('Comentario agregado');
      setNewComment('');
      setShowCommentBox(false);
      qc.invalidateQueries({ queryKey: ['section', sectionId] });
    },
  });

  const resolveCommentMutation = useMutation({
    mutationFn: (commentId: string) => sectionsApi.resolveComment(commentId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['section', sectionId] }),
  });

  const handleContentChange = useCallback(
    (content: Record<string, any>, wordCount: number) => {
      pendingContent.current = { content, wordCount };
    },
    [],
  );

  const handleAutoSave = useCallback(async () => {
    if (!pendingContent.current) return;
    const { content, wordCount } = pendingContent.current;

    if (primaryBlock) {
      await updateBlockMutation.mutateAsync({ id: primaryBlock.id, data: { content, wordCount } });
    } else {
      await createBlockMutation.mutateAsync({ content, wordCount, type: 'PARAGRAPH' });
    }
    pendingContent.current = null;
  }, [primaryBlock, updateBlockMutation, createBlockMutation]);

  const handleManualSave = useCallback(async () => {
    if (pendingContent.current) await handleAutoSave();
    if (primaryBlock) await saveVersionMutation.mutateAsync('Guardado manual');
  }, [handleAutoSave, primaryBlock, saveVersionMutation]);

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin w-7 h-7 border-2 border-unphu-600 border-t-transparent rounded-full" />
    </div>
  );

  if (!section) return null;

  const status = section.status as string;
  const isEditable = ['DRAFT', 'IN_PROGRESS', 'RETURNED'].includes(status);
  const canSubmit = status === 'IN_PROGRESS' || (status === 'RETURNED' && !!primaryBlock);
  const activeComments = section.comments?.filter((c: any) => !c.resolved) ?? [];
  const resolvedComments = section.comments?.filter((c: any) => c.resolved) ?? [];
  const history = section.history ?? [];

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/dashboard/student/document" className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-gray-900 truncate">{section.title}</h1>
            <span className={`badge text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[status] ?? 'bg-gray-100 text-gray-600'}`}>
              {STATUS_LABELS[status] ?? status}
            </span>
          </div>
          {section.minWords && (
            <p className="text-xs text-gray-400 mt-0.5">
              Mínimo {section.minWords} palabras
              {section.maxWords ? ` · Máximo ${section.maxWords}` : ''}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={() => { setShowAiPanel(!showAiPanel); setAiResult(''); }}
            className={`text-sm py-1.5 px-3 rounded-lg border font-medium inline-flex items-center gap-1.5 transition-colors ${
              showAiPanel
                ? 'bg-purple-600 text-white border-purple-600'
                : 'border-purple-200 text-purple-600 hover:bg-purple-50'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" /> Asistente AI
          </button>
          {isEditable && canSubmit && (
            <button
              onClick={() => setShowSubmitPanel(!showSubmitPanel)}
              className="btn-primary text-sm py-1.5 inline-flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" /> Enviar a revisión
            </button>
          )}
        </div>
      </div>

      {/* Returned notice */}
      {status === 'RETURNED' && activeComments.length > 0 && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-700">Sección devuelta para corrección</p>
            <p className="text-sm text-red-600 mt-0.5">
              Tu asesor dejó {activeComments.length} comentario(s). Revísalos, haz las correcciones y vuelve a enviar.
            </p>
          </div>
        </div>
      )}

      {/* Approved notice */}
      {status === 'APPROVED' && (
        <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
          <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
          <p className="text-sm font-semibold text-green-700">Sección aprobada por tu asesor. Solo lectura.</p>
        </div>
      )}

      {/* Submit panel */}
      {showSubmitPanel && (
        <div className="card p-4 border-amber-200 bg-amber-50">
          <h3 className="font-semibold text-gray-900 text-sm mb-2">Enviar sección a revisión</h3>
          <textarea
            value={submitNotes}
            onChange={(e) => setSubmitNotes(e.target.value)}
            placeholder="Notas para tu asesor (opcional)..."
            className="input w-full text-sm resize-none"
            rows={2}
          />
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => submitMutation.mutate()}
              disabled={submitMutation.isPending}
              className="btn-primary text-sm py-1.5"
            >
              {submitMutation.isPending ? 'Enviando...' : 'Confirmar envío'}
            </button>
            <button onClick={() => setShowSubmitPanel(false)} className="btn-secondary text-sm py-1.5">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* AI Panel */}
      {showAiPanel && (
        <div className="card p-4 border-purple-100 bg-gradient-to-br from-purple-50 to-white">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-purple-900 text-sm flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-600" />
              Asistente AI — {section.title}
            </h3>
            <button onClick={() => setShowAiPanel(false)} className="text-purple-300 hover:text-purple-600">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
            {AI_ACTIONS.map(({ id, label, icon: Icon, desc }) => (
              <button
                key={id}
                onClick={() => runAi(id)}
                disabled={aiLoading}
                title={desc}
                className={`flex flex-col items-center gap-1 p-2.5 rounded-lg border text-xs font-medium transition-colors
                  ${aiAction === id && aiLoading
                    ? 'bg-purple-600 text-white border-purple-600'
                    : 'bg-white border-purple-100 text-purple-700 hover:bg-purple-50 hover:border-purple-300 disabled:opacity-50'
                  }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>

          {/* Result area */}
          {(aiResult || aiLoading) && (
            <div className="relative">
              <div className="bg-white border border-purple-100 rounded-lg p-3 text-sm text-gray-700 whitespace-pre-wrap max-h-64 overflow-y-auto leading-relaxed">
                {aiResult || <span className="text-purple-400 animate-pulse">Generando respuesta...</span>}
              </div>
              {aiResult && !aiLoading && (
                <button
                  onClick={() => navigator.clipboard.writeText(aiResult).then(() => toast.success('Copiado al portapapeles'))}
                  className="mt-1.5 text-xs text-purple-500 hover:text-purple-700 font-medium"
                >
                  Copiar texto
                </button>
              )}
            </div>
          )}

          {!aiResult && !aiLoading && (
            <p className="text-xs text-purple-400 text-center py-2">
              Selecciona una acción para obtener ayuda con esta sección
            </p>
          )}
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Editor */}
        <div className="lg:col-span-2">
          <div className="card overflow-hidden">
            <BlockEditor
              content={primaryBlock?.content ?? null}
              onChange={handleContentChange}
              onSave={isEditable ? handleManualSave : undefined}
              readOnly={!isEditable}
              placeholder={`Escribe el contenido de "${section.title}"...`}
              blockId={primaryBlock?.id}
              currentUser={user ? { name: `${user.firstName} ${user.lastName}`, color: '#2563eb' } : undefined}
            />
          </div>
        </div>

        {/* Right panel: comments + history */}
        <div className="space-y-4">
          {/* Comments */}
          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Comentarios
                {activeComments.length > 0 && (
                  <span className="bg-red-500 text-white text-xs rounded-full px-1.5">{activeComments.length}</span>
                )}
              </h3>
              <button
                onClick={() => setShowCommentBox(!showCommentBox)}
                className="text-xs text-unphu-600 hover:text-unphu-700 font-medium"
              >
                + Agregar
              </button>
            </div>

            {showCommentBox && (
              <div className="mb-3">
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Escribe un comentario..."
                  className="input w-full text-sm resize-none"
                  rows={2}
                />
                <div className="flex gap-1.5 mt-1.5">
                  <button
                    onClick={() => addCommentMutation.mutate()}
                    disabled={!newComment.trim() || addCommentMutation.isPending}
                    className="btn-primary text-xs py-1"
                  >
                    Enviar
                  </button>
                  <button onClick={() => { setShowCommentBox(false); setNewComment(''); }} className="btn-secondary text-xs py-1">
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {activeComments.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-4">Sin comentarios activos</p>
              )}
              {activeComments.map((c: any) => (
                <CommentBubble key={c.id} comment={c} onResolve={(id) => resolveCommentMutation.mutate(id)} />
              ))}
            </div>

            {resolvedComments.length > 0 && (
              <p className="text-xs text-gray-400 mt-2">{resolvedComments.length} comentario(s) resuelto(s)</p>
            )}
          </div>

          {/* History */}
          <div className="card p-4">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="flex items-center justify-between w-full"
            >
              <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
                <History className="w-4 h-4" />
                Historial de estados
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
                        <p className="font-medium text-gray-800">
                          {STATUS_LABELS[h.toStatus] ?? h.toStatus}
                        </p>
                        <p className="text-gray-400">{formatDate(h.createdAt)}</p>
                        {h.notes && <p className="text-gray-500 mt-0.5 italic">"{h.notes}"</p>}
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
