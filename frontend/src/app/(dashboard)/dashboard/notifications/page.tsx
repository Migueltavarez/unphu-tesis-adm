'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import {
  Bell, CheckCheck, Info, CheckCircle2, AlertCircle, BellRing,
  ChevronLeft, ChevronRight,
} from 'lucide-react';

const TYPE_FILTERS = [
  { value: '', label: 'Todas' },
  { value: 'THESIS_CREATED', label: 'Postulaciones' },
  { value: 'STATUS_CHANGED', label: 'Cambios de estado' },
  { value: 'ADVANCE_SUBMITTED', label: 'Avances' },
  { value: 'PAYMENT_CONFIRMED', label: 'Pagos' },
  { value: 'MEETING_SCHEDULED', label: 'Reuniones' },
];

const TYPE_ICONS: Record<string, { icon: any; color: string; bg: string }> = {
  THESIS_CREATED:  { icon: Bell,         color: 'text-blue-600',   bg: 'bg-blue-50' },
  STATUS_CHANGED:  { icon: Info,          color: 'text-amber-600',  bg: 'bg-amber-50' },
  ADVANCE_SUBMITTED: { icon: BellRing,   color: 'text-purple-600', bg: 'bg-purple-50' },
  PAYMENT_CONFIRMED: { icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50' },
  MEETING_SCHEDULED: { icon: CheckCircle2, color: 'text-teal-600', bg: 'bg-teal-50' },
  DEFAULT:         { icon: AlertCircle,   color: 'text-gray-500',   bg: 'bg-gray-100' },
};

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['notifications-all', page, typeFilter],
    queryFn: () => notificationsApi.getAll(page, typeFilter || undefined),
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications-all'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread'] });
    },
  });

  const markAllMutation = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications-all'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread'] });
    },
  });

  const notifications: any[] = data?.data ?? [];
  const total: number = data?.total ?? 0;
  const totalPages = Math.ceil(total / 20);
  const unreadInPage = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notificaciones</h1>
          <p className="text-gray-500 text-sm mt-1">{total} notificacion{total !== 1 ? 'es' : ''} en total</p>
        </div>
        {unreadInPage > 0 && (
          <button
            onClick={() => markAllMutation.mutate()}
            disabled={markAllMutation.isPending}
            className="flex items-center gap-2 text-sm text-unphu-600 hover:text-unphu-700 font-medium disabled:opacity-50"
          >
            <CheckCheck className="w-4 h-4" />
            Marcar todas como leídas
          </button>
        )}
      </div>

      {/* Type filter tabs */}
      <div className="flex gap-1 flex-wrap">
        {TYPE_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => { setTypeFilter(f.value); setPage(1); }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              typeFilter === f.value
                ? 'bg-unphu-700 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin w-8 h-8 border-2 border-unphu-600 border-t-transparent rounded-full" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="card p-16 text-center">
          <Bell className="w-12 h-12 text-gray-200 mx-auto mb-4" />
          <p className="text-gray-400 text-sm">No hay notificaciones</p>
        </div>
      ) : (
        <div className="card divide-y divide-gray-50 overflow-hidden">
          {notifications.map((n: any) => {
            const cfg = TYPE_ICONS[n.type] ?? TYPE_ICONS.DEFAULT;
            const Icon = cfg.icon;
            return (
              <div
                key={n.id}
                onClick={() => !n.isRead && markReadMutation.mutate(n.id)}
                className={`flex gap-4 px-5 py-4 transition-colors ${
                  !n.isRead
                    ? 'bg-unphu-50/40 hover:bg-unphu-50 cursor-pointer'
                    : 'hover:bg-gray-50'
                }`}
              >
                <div className={`w-9 h-9 rounded-full ${cfg.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                  <Icon className={`w-4 h-4 ${cfg.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-sm ${!n.isRead ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
                      {n.title}
                    </p>
                    {!n.isRead && (
                      <span className="w-2 h-2 rounded-full bg-unphu-600 flex-shrink-0 mt-1.5" />
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5 leading-snug">{n.message}</p>
                  <p className="text-xs text-gray-400 mt-1.5">{formatDate(n.createdAt)}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 disabled:opacity-40"
          >
            <ChevronLeft className="w-4 h-4" /> Anterior
          </button>
          <span className="text-sm text-gray-500">
            Página {page} de {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 disabled:opacity-40"
          >
            Siguiente <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
