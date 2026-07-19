'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { paymentsApi, thesisApi } from '@/lib/api';
import { CheckCircle, XCircle, CreditCard, Download } from 'lucide-react';
import toast from 'react-hot-toast';

export default function CajaPaymentsPage() {
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState<Record<string, string>>({});

  const { data: pendingData, isLoading } = useQuery({
    queryKey: ['caja-pending-list'],
    queryFn: () => thesisApi.list({ status: 'CAJA_PENDING' }),
  });

  const { data: confirmedData } = useQuery({
    queryKey: ['caja-confirmed-list'],
    queryFn: () => thesisApi.list({ status: 'PAYMENT_CONFIRMED' }),
  });

  const confirmMutation = useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) =>
      paymentsApi.cajaConfirm(id, note),
    onSuccess: () => {
      toast.success('Pago confirmado');
      queryClient.invalidateQueries({ queryKey: ['caja-pending-list'] });
      queryClient.invalidateQueries({ queryKey: ['caja-confirmed-list'] });
    },
    onError: () => toast.error('Error al confirmar el pago'),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      paymentsApi.reject(id, reason),
    onSuccess: () => {
      toast.success('Pago devuelto a Cobros');
      queryClient.invalidateQueries({ queryKey: ['caja-pending-list'] });
    },
    onError: () => toast.error('Error al rechazar el pago'),
  });

  const pending = pendingData?.data ?? pendingData ?? [];
  const confirmed = (confirmedData?.data ?? confirmedData ?? []).slice(0, 10);

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Confirmación de Pagos</h1>
          <p className="text-gray-500 text-sm mt-1">
            Estudiantes que deben pagar su inscripción. Confirma luego de recibir el dinero.
          </p>
        </div>
        <button
          onClick={() => paymentsApi.exportCsv()}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
        >
          <Download className="w-4 h-4" /> Exportar CSV
        </button>
      </div>

      {/* Pending payments */}
      <section>
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
          Por cobrar ({pending.length})
        </h2>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin w-6 h-6 border-2 border-unphu-600 border-t-transparent rounded-full" />
          </div>
        ) : pending.length === 0 ? (
          <div className="card p-12 text-center text-gray-400">
            <CreditCard className="w-12 h-12 mx-auto mb-3 text-gray-200" />
            <p className="text-sm">No hay pagos pendientes de confirmar</p>
          </div>
        ) : (
          <div className="space-y-4">
            {pending.map((w: any) => (
              <div key={w.id} className="card p-5 border-l-4 border-orange-400">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <p className="font-semibold text-gray-900 text-lg">
                      {w.student?.user?.firstName} {w.student?.user?.lastName}
                    </p>
                    <p className="text-sm text-gray-500">
                      Matrícula: <span className="font-medium">{w.student?.matricula}</span>
                    </p>
                    <p className="text-sm text-gray-500">
                      Carrera: <span className="font-medium">{w.career?.name}</span>
                    </p>
                    <p className="text-sm text-gray-600 mt-1 line-clamp-2">{w.title}</p>
                  </div>
                  {w.payment?.amount && (
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs text-gray-400 mb-0.5">Monto a cobrar</p>
                      <p className="text-2xl font-bold text-orange-600">
                        RD$ {Number(w.payment.amount).toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>

                <div className="space-y-2 pt-3 border-t border-gray-100">
                  <input
                    type="text"
                    placeholder="Nota / referencia de recibo (opcional)..."
                    value={notes[w.id] || ''}
                    onChange={(e) => setNotes((prev) => ({ ...prev, [w.id]: e.target.value }))}
                    className="input text-sm"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => confirmMutation.mutate({ id: w.id, note: notes[w.id] })}
                      disabled={confirmMutation.isPending}
                      className="flex items-center gap-1.5 px-5 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg"
                    >
                      <CheckCircle className="w-4 h-4" /> Confirmar pago recibido
                    </button>
                    <button
                      onClick={() => {
                        const reason = notes[w.id] || 'Devuelto a Cobros';
                        rejectMutation.mutate({ id: w.id, reason });
                      }}
                      disabled={rejectMutation.isPending}
                      className="flex items-center gap-1.5 px-4 py-2 bg-white border border-red-300 text-red-600 hover:bg-red-50 text-sm font-medium rounded-lg"
                    >
                      <XCircle className="w-4 h-4" /> Devolver a Cobros
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Confirmed */}
      {confirmed.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-500" />
            Pagos confirmados
          </h2>
          <div className="space-y-2">
            {confirmed.map((w: any) => (
              <div key={w.id} className="card p-4 flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium text-gray-900 text-sm">
                    {w.student?.user?.firstName} {w.student?.user?.lastName}
                  </p>
                  <p className="text-xs text-gray-400">{w.student?.matricula} · {w.career?.name}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  {w.payment?.amount && (
                    <p className="text-sm font-semibold text-gray-700">
                      RD$ {Number(w.payment.amount).toLocaleString()}
                    </p>
                  )}
                  <span className="badge bg-green-100 text-green-700 text-xs">Confirmado</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
