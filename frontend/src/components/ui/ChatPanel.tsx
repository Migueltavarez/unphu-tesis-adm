'use client';
import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { messagesApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { Send, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

const ROLE_LABELS: Record<string, string> = {
  STUDENT: 'Estudiante',
  ADVISOR: 'Asesor',
  COORDINATOR: 'Coordinador',
  ADMIN: 'Admin',
  DIRECTOR: 'Director',
};

const ROLE_COLORS: Record<string, string> = {
  STUDENT: 'bg-blue-100 text-blue-700',
  ADVISOR: 'bg-teal-100 text-teal-700',
  COORDINATOR: 'bg-purple-100 text-purple-700',
  ADMIN: 'bg-red-100 text-red-700',
  DIRECTOR: 'bg-indigo-100 text-indigo-700',
};

interface Props {
  thesisWorkId: string;
  /** Título opcional del panel */
  title?: string;
  /** Si es true, el panel tiene altura fija con scroll interno */
  fixed?: boolean;
}

export default function ChatPanel({ thesisWorkId, title = 'Chat con el asesor', fixed = true }: Props) {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [text, setText] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['messages', thesisWorkId],
    queryFn: () => messagesApi.list(thesisWorkId),
    // Refresca cada 10 segundos para simular "tiempo real"
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
  });

  // Marcar como leídos al abrir
  useEffect(() => {
    if (thesisWorkId && user) {
      messagesApi.markRead(thesisWorkId).catch(() => {});
    }
  }, [thesisWorkId, user]);

  // Scroll al último mensaje
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMutation = useMutation({
    mutationFn: (content: string) => messagesApi.send(thesisWorkId, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', thesisWorkId] });
      setText('');
      inputRef.current?.focus();
    },
  });

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || sendMutation.isPending) return;
    sendMutation.mutate(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Agrupar mensajes consecutivos del mismo sender
  const grouped = messages.reduce((acc: any[], msg: any, i: number) => {
    const prev = messages[i - 1];
    const sameUser = prev?.senderId === msg.senderId;
    const closeInTime = prev && (new Date(msg.createdAt).getTime() - new Date(prev.createdAt).getTime()) < 2 * 60 * 1000;
    acc.push({ ...msg, showHeader: !sameUser || !closeInTime });
    return acc;
  }, []);

  const isMe = (senderId: string) => senderId === user?.id;

  const formatTime = (date: string) =>
    new Intl.DateTimeFormat('es-DO', { hour: '2-digit', minute: '2-digit' }).format(new Date(date));

  const formatDateSeparator = (date: string) =>
    new Intl.DateTimeFormat('es-DO', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date(date));

  // Inserta separadores de fecha entre mensajes de días distintos
  const withDateSep: Array<any> = [];
  let lastDate = '';
  for (const msg of grouped) {
    const d = new Date(msg.createdAt).toDateString();
    if (d !== lastDate) {
      withDateSep.push({ type: 'date', date: msg.createdAt, id: `date-${msg.id}` });
      lastDate = d;
    }
    withDateSep.push({ type: 'msg', ...msg });
  }

  return (
    <div className={cn('flex flex-col bg-white rounded-xl border border-gray-200 overflow-hidden', fixed && 'h-[520px]')}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50">
        <MessageSquare className="w-4 h-4 text-unphu-600" />
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        <span className="ml-auto text-xs text-gray-400">
          {messages.length} {messages.length === 1 ? 'mensaje' : 'mensajes'}
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1 scroll-smooth">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin w-6 h-6 border-2 border-unphu-600 border-t-transparent rounded-full" />
          </div>
        ) : withDateSep.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-12 text-gray-400">
            <MessageSquare className="w-10 h-10 text-gray-200 mb-2" />
            <p className="text-sm">No hay mensajes aún</p>
            <p className="text-xs mt-1">Inicia la conversación sobre el trabajo de grado</p>
          </div>
        ) : (
          withDateSep.map((item) => {
            if (item.type === 'date') {
              return (
                <div key={item.id} className="flex items-center gap-3 py-2">
                  <div className="flex-1 h-px bg-gray-100" />
                  <span className="text-xs text-gray-400 px-2">{formatDateSeparator(item.date)}</span>
                  <div className="flex-1 h-px bg-gray-100" />
                </div>
              );
            }

            const mine = isMe(item.senderId);
            return (
              <div key={item.id} className={cn('flex gap-2', mine ? 'flex-row-reverse' : 'flex-row')}>
                {/* Avatar */}
                {item.showHeader && !mine && (
                  <div className="w-7 h-7 rounded-full bg-teal-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5">
                    {item.senderName?.charAt(0) ?? '?'}
                  </div>
                )}
                {(!item.showHeader || mine) && <div className="w-7 flex-shrink-0" />}

                <div className={cn('max-w-[75%] flex flex-col', mine ? 'items-end' : 'items-start')}>
                  {item.showHeader && (
                    <div className={cn('flex items-center gap-1.5 mb-1', mine ? 'flex-row-reverse' : 'flex-row')}>
                      <span className="text-xs font-medium text-gray-700">
                        {mine ? 'Tú' : item.senderName}
                      </span>
                      <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium', ROLE_COLORS[item.senderRole] ?? 'bg-gray-100 text-gray-600')}>
                        {ROLE_LABELS[item.senderRole] ?? item.senderRole}
                      </span>
                    </div>
                  )}
                  <div className={cn(
                    'px-3 py-2 rounded-2xl text-sm leading-relaxed break-words',
                    mine
                      ? 'bg-unphu-700 text-white rounded-tr-sm'
                      : 'bg-gray-100 text-gray-900 rounded-tl-sm',
                    item.showHeader ? '' : (mine ? 'rounded-tr-2xl' : 'rounded-tl-2xl'),
                  )}>
                    {item.content}
                  </div>
                  <span className="text-[10px] text-gray-400 mt-0.5 px-1">
                    {formatTime(item.createdAt)}
                    {mine && (
                      <span className="ml-1">{item.isRead ? '✓✓' : '✓'}</span>
                    )}
                  </span>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-100 p-3 bg-gray-50">
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe un mensaje… (Enter para enviar, Shift+Enter para nueva línea)"
            rows={1}
            className="flex-1 resize-none rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-unphu-500 focus:border-transparent placeholder:text-gray-400 max-h-32 overflow-y-auto"
            style={{ minHeight: '38px' }}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = 'auto';
              el.style.height = Math.min(el.scrollHeight, 128) + 'px';
            }}
          />
          <button
            onClick={handleSend}
            disabled={!text.trim() || sendMutation.isPending}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-unphu-700 hover:bg-unphu-800 disabled:opacity-40 text-white transition-colors flex-shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[10px] text-gray-400 mt-1.5 pl-1">
          Los mensajes quedan registrados como evidencia del proceso de tutoría.
        </p>
      </div>
    </div>
  );
}
