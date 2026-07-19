'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { paymentsApi } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { CreditCard, Download, Info } from 'lucide-react';

const FILTERS = [
  { value: 'PENDING',   label: 'Pendientes' },
  { value: 'CONFIRMED', label: 'Confirmados' },
  { value: 'REJECTED',  label: 'Rechazados' },
  { value: '',          label: 'Todos' },
] as const;

const STATUS_BADGE: Record<string, string> = {
  PENDING:   'bg-yellow-100 text-yellow-700',
  CONFIRMED: 'bg-green-100 text-green-700',
  REJECTED:  'bg-red-100 text-red-700',
};

const STATUS_LABEL: Record<string, string> = {
  PENDING:   'Pendiente',
  CONFIRMED: 'Confirmado',
  REJECTED:  'Rechazado',
};

export default function CoordinatorPaymentsPage() {
  const [filter, setFilter] = useState<string>('');

  const { data: payments, isLoading } = useQuery({
    queryKey: ['coordinator-payments', filter],
    queryFn: () => paymentsApi.listAll(filter || undefined),
  });

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pagos de inscripción</h1>
          <p className="text-gray-500 text-sm mt-1">Seguimiento del proceso de cobro de trabajos de grado</p>
        </div>
        <button
          onClick={() => paymentsApi.exportCsv()}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
        >
          <Download className="w-4 h-4" /> Exportar CSV
        </button>
      </div>

      <div className="flex items-center gap-2 px-4 py-2.5 bg-blue-50 border border-blue-100 rounded-lg text-sm text-blue-800">
        <Info className="w-4 h-4 flex-shrink-0" />
        <span>Los pagos son gestionados por Cobros (fija el monto) y Caja (confirma la recepción). Aquí puedes ver el estado actual.</span>
      </div>

      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              filter === f.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
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
      ) : !payments?.length ? (
        <div className="card p-12 text-center text-gray-400">
          <CreditCard className="w-12 h-12 mx-auto mb-3 text-gray-200" />
          <p className="text-sm">No hay pagos en esta categoría</p>
        </div>
      ) : (
        <div className="space-y-3">
          {payments.map((p: any) => (
            <div key={p.id} className="card p-5 flex items-center gap-4">
              <div className="w-9 h-9 rounded-lg bg-yellow-50 flex items-center justify-center flex-shrink-0">
                <CreditCard className="w-4 h-4 text-yellow-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 text-sm">
                  {p.thesisWork?.student?.user?.firstName} {p.thesisWork?.student?.user?.lastName}
                </p>
                <p className="text-xs text-gray-500 truncate">{p.thesisWork?.title}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {p.thesisWork?.student?.career?.name}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                {p.amount > 0 && (
                  <p className="text-sm font-bold text-gray-700 mb-1">RD$ {Number(p.amount).toLocaleString()}</p>
                )}
                <span className={`badge text-xs ${STATUS_BADGE[p.status] ?? 'bg-gray-100 text-gray-700'}`}>
                  {STATUS_LABEL[p.status] ?? p.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
