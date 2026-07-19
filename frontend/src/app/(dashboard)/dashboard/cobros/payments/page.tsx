'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { paymentsApi, thesisApi } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { DollarSign, Send, Download, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function CobrosPaymentsPage() {
  const queryClient = useQueryClient();
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});

  // Works in REGISTERED state (waiting for Cobros to set amount)
  const { data: worksData, isLoading } = useQuery({
    queryKey: ['cobros-registered'],
    queryFn: () => thesisApi.list({ status: 'REGISTERED' }),
  });

  // Also show works already sent to Caja (CAJA_PENDING) and confirmed
  const { data: cajaPendingData } = useQuery({
    queryKey: ['cobros-caja-pending'],
    queryFn: () => thesisApi.list({ status: 'CAJA_PENDING' }),
  });

  const { data: confirmedData } = useQuery({
    queryKey: ['cobros-confirmed'],
    queryFn: () => thesisApi.list({ status: 'PAYMENT_CONFIRMED' }),
  });

  const setAmountMutation = useMutation({
    mutationFn: ({ id, amount, note }: { id: string; amount: number; note?: string }) =>
      paymentsApi.setAmount(id, amount, note),
    onSuccess: () => {
      toast.success('Monto enviado a Caja');
      queryClient.invalidateQueries({ queryKey: ['cobros-registered'] });
      queryClient.invalidateQueries({ queryKey: ['cobros-caja-pending'] });
    },
    onError: () => toast.error('Error al enviar el monto'),
  });

  const registered = worksData?.data ?? worksData ?? [];
  const cajaPending = cajaPendingData?.data ?? cajaPendingData ?? [];
  const confirmed = (confirmedData?.data ?? confirmedData ?? []).slice(0, 5);

  const handleSetAmount = (workId: string) => {
    const raw = amounts[workId];
    const amount = parseFloat(raw);
    if (!raw || isNaN(amount) || amount <= 0) {
      toast.error('Ingresa un monto válido');
      return;
    }
    setAmountMutation.mutate({ id: workId, amount, note: notes[workId] });
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestión de Cobros</h1>
          <p className="text-gray-500 text-sm mt-1">Fija el monto de inscripción y envía a Caja para su cobro</p>
        </div>
        <button
          onClick={() => paymentsApi.exportCsv()}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
        >
          <Download className="w-4 h-4" /> Exportar CSV
        </button>
      </div>

      {/* Works awaiting amount – REGISTERED */}
      <section>
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3 flex items-center gap-2">
          <Clock className="w-4 h-4 text-sky-600" />
          Registros pendientes de cobro
          {registered.length > 0 && (
            <span className="ml-1 bg-sky-100 text-sky-700 text-xs font-bold px-2 py-0.5 rounded-full">{registered.length}</span>
          )}
        </h2>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin w-6 h-6 border-2 border-unphu-600 border-t-transparent rounded-full" />
          </div>
        ) : registered.length === 0 ? (
          <div className="card p-8 text-center text-gray-400">
            <CheckCircle className="w-10 h-10 mx-auto mb-2 text-gray-200" />
            <p className="text-sm">No hay registros pendientes en este momento</p>
          </div>
        ) : (
          <div className="space-y-4">
            {registered.map((w: any) => (
              <div key={w.id} className="card p-5 border-l-4 border-sky-400">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <p className="font-semibold text-gray-900">
                      {w.student?.user?.firstName} {w.student?.user?.lastName}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {w.student?.matricula} · {w.career?.name}
                    </p>
                    <p className="text-sm text-gray-600 mt-1 line-clamp-1">{w.title}</p>
                  </div>
                  <span className="badge bg-sky-100 text-sky-700 flex-shrink-0">Registrado</span>
                </div>

                <div className="space-y-2">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">RD$</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={amounts[w.id] || ''}
                        onChange={(e) => setAmounts((prev) => ({ ...prev, [w.id]: e.target.value }))}
                        className="input pl-10 text-sm"
                      />
                    </div>
                    <button
                      onClick={() => handleSetAmount(w.id)}
                      disabled={setAmountMutation.isPending}
                      className="flex items-center gap-1.5 px-4 py-2 bg-unphu-700 hover:bg-unphu-800 text-white text-sm font-medium rounded-lg flex-shrink-0"
                    >
                      <Send className="w-3.5 h-3.5" /> Enviar a Caja
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder="Nota opcional..."
                    value={notes[w.id] || ''}
                    onChange={(e) => setNotes((prev) => ({ ...prev, [w.id]: e.target.value }))}
                    className="input text-sm"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Works sent to Caja */}
      {cajaPending.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-orange-500" />
            Enviados a Caja (pendientes de cobro)
          </h2>
          <div className="space-y-3">
            {cajaPending.map((w: any) => (
              <div key={w.id} className="card p-4 flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium text-gray-900 text-sm">
                    {w.student?.user?.firstName} {w.student?.user?.lastName}
                  </p>
                  <p className="text-xs text-gray-400">
                    {w.student?.matricula} · {w.career?.name}
                  </p>
                  {w.payment?.amount && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      Monto: <span className="font-semibold text-gray-700">RD$ {Number(w.payment.amount).toLocaleString()}</span>
                    </p>
                  )}
                </div>
                <span className="badge bg-orange-100 text-orange-700 flex-shrink-0">En Caja</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recently confirmed */}
      {confirmed.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-500" />
            Pagos confirmados recientemente
          </h2>
          <div className="space-y-2">
            {confirmed.map((w: any) => (
              <div key={w.id} className="card p-4 flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium text-gray-900 text-sm">
                    {w.student?.user?.firstName} {w.student?.user?.lastName}
                  </p>
                  {w.payment?.amount && (
                    <p className="text-xs text-gray-500">RD$ {Number(w.payment.amount).toLocaleString()}</p>
                  )}
                </div>
                <span className="badge bg-green-100 text-green-700 flex-shrink-0">Confirmado</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
