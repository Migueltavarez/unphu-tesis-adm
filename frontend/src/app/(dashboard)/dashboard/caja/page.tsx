'use client';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { thesisApi } from '@/lib/api';
import { CreditCard, Clock, CheckCircle } from 'lucide-react';

export default function CajaDashboard() {
  const { data: pendingData } = useQuery({
    queryKey: ['caja-pending'],
    queryFn: () => thesisApi.list({ status: 'CAJA_PENDING' }),
  });

  const { data: confirmedData } = useQuery({
    queryKey: ['caja-confirmed-today'],
    queryFn: () => thesisApi.list({ status: 'PAYMENT_CONFIRMED' }),
  });

  const pending = pendingData?.data ?? pendingData ?? [];
  const confirmed = confirmedData?.data ?? confirmedData ?? [];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Departamento de Caja</h1>
        <p className="text-gray-500 text-sm mt-1">Confirmación de pagos de inscripción enviados por Cobros</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="card p-5 text-center border-l-4 border-orange-400">
          <p className="text-3xl font-bold text-orange-600">{pending.length}</p>
          <p className="text-xs text-gray-500 mt-1">Pendientes de cobro</p>
        </div>
        <div className="card p-5 text-center border-l-4 border-green-400">
          <p className="text-3xl font-bold text-green-600">{confirmed.length}</p>
          <p className="text-xs text-gray-500 mt-1">Confirmados</p>
        </div>
      </div>

      <div className="card p-6 space-y-3">
        <h2 className="font-semibold text-gray-900 flex items-center gap-2">
          <Clock className="w-4 h-4 text-orange-500" />
          Pagos pendientes de confirmar
        </h2>
        {pending.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">No hay pagos pendientes</p>
        ) : (
          <div className="space-y-2">
            {pending.slice(0, 5).map((w: any) => (
              <div key={w.id} className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {w.student?.user?.firstName} {w.student?.user?.lastName}
                  </p>
                  <p className="text-xs text-gray-500">{w.student?.matricula}</p>
                  {w.payment?.amount && (
                    <p className="text-xs font-semibold text-orange-700 mt-0.5">
                      RD$ {Number(w.payment.amount).toLocaleString()}
                    </p>
                  )}
                </div>
                <span className="badge bg-orange-100 text-orange-700">Pendiente</span>
              </div>
            ))}
          </div>
        )}
        <Link
          href="/dashboard/caja/payments"
          className="inline-flex items-center gap-2 px-4 py-2 bg-unphu-700 hover:bg-unphu-800 text-white text-sm font-medium rounded-lg"
        >
          <CreditCard className="w-4 h-4" /> Ver todos los pagos
        </Link>
      </div>
    </div>
  );
}
