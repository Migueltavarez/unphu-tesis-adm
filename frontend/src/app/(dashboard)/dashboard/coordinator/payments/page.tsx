'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { paymentsApi } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { CreditCard, CheckCircle, XCircle, ExternalLink } from 'lucide-react';

export default function CoordinatorPaymentsPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<'SUBMITTED' | 'CONFIRMED' | 'REJECTED' | ''>('SUBMITTED');
  const [notes, setNotes] = useState<Record<string, string>>({});

  const { data: payments, isLoading } = useQuery({
    queryKey: ['payments', filter],
    queryFn: () => paymentsApi.listAll(filter || undefined),
  });

  const confirmMutation = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) =>
      paymentsApi.confirm(id, notes),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['payments'] }),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) =>
      paymentsApi.reject(id, notes),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['payments'] }),
  });

  const FILTERS = [
    { value: 'SUBMITTED', label: 'Por revisar' },
    { value: 'CONFIRMED', label: 'Confirmados' },
    { value: 'REJECTED', label: 'Rechazados' },
    { value: '', label: 'Todos' },
  ] as const;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Comprobantes de pago</h1>
        <p className="text-gray-500 text-sm mt-1">Revisión y confirmación de pagos de inscripción</p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value as any)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              filter === f.value
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin w-8 h-8 border-2 border-unphu-600 border-t-transparent rounded-full" />
        </div>
      ) : payments?.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <CreditCard className="w-12 h-12 mx-auto mb-3 text-gray-200" />
          <p className="text-sm">No hay comprobantes en esta categoría</p>
        </div>
      ) : (
        <div className="space-y-4">
          {payments?.map((p: any) => (
            <div key={p.id} className="card p-6">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-yellow-50 flex items-center justify-center flex-shrink-0">
                    <CreditCard className="w-5 h-5 text-yellow-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">
                      {p.thesisWork?.student?.user?.firstName} {p.thesisWork?.student?.user?.lastName}
                    </p>
                    <p className="text-sm text-gray-500">
                      {p.thesisWork?.title}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Monto: RD$ {Number(p.amount).toLocaleString()} · {formatDate(p.createdAt)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`badge ${
                    p.status === 'CONFIRMED' ? 'bg-green-100 text-green-700' :
                    p.status === 'REJECTED' ? 'bg-red-100 text-red-700' :
                    'bg-yellow-100 text-yellow-700'
                  }`}>
                    {p.status === 'CONFIRMED' ? 'Confirmado' :
                     p.status === 'REJECTED' ? 'Rechazado' : 'Por revisar'}
                  </span>
                </div>
              </div>

              {p.receiptUrl && (
                <a
                  href={p.receiptUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-1.5 text-sm text-unphu-600 hover:underline"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Ver comprobante
                </a>
              )}

              {p.status === 'SUBMITTED' && (
                <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
                  <div>
                    <label className="label text-xs">Nota (opcional)</label>
                    <input
                      value={notes[p.id] || ''}
                      onChange={(e) => setNotes((prev) => ({ ...prev, [p.id]: e.target.value }))}
                      placeholder="Observación sobre el comprobante..."
                      className="input text-sm"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => confirmMutation.mutate({ id: p.thesisWorkId, notes: notes[p.id] })}
                      disabled={confirmMutation.isPending}
                      className="flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                      <CheckCircle className="w-4 h-4" /> Confirmar pago
                    </button>
                    <button
                      onClick={() => rejectMutation.mutate({ id: p.thesisWorkId, notes: notes[p.id] })}
                      disabled={rejectMutation.isPending}
                      className="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                      <XCircle className="w-4 h-4" /> Rechazar
                    </button>
                  </div>
                </div>
              )}

              {p.notes && (
                <p className="mt-3 text-xs text-gray-500 italic border-t border-gray-100 pt-3">
                  Nota: {p.notes}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
