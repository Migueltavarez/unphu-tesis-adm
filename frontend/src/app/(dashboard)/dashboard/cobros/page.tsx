'use client';
import { useQuery } from '@tanstack/react-query';
import { thesisApi } from '@/lib/api';
import { CreditCard, Clock, CheckCircle, Send } from 'lucide-react';

export default function CobrosDashboard() {
  const { data: registeredData } = useQuery({
    queryKey: ['cobros-registered-count'],
    queryFn: () => thesisApi.list({ status: 'REGISTERED' }),
  });

  const { data: cajaPendingData } = useQuery({
    queryKey: ['cobros-caja-count'],
    queryFn: () => thesisApi.list({ status: 'CAJA_PENDING' }),
  });

  const { data: confirmedData } = useQuery({
    queryKey: ['cobros-confirmed-count'],
    queryFn: () => thesisApi.list({ status: 'PAYMENT_CONFIRMED' }),
  });

  const registered = (registeredData?.data ?? registeredData ?? []).length;
  const cajaPending = (cajaPendingData?.data ?? cajaPendingData ?? []).length;
  const confirmed = (confirmedData?.data ?? confirmedData ?? []).length;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Departamento de Cobros</h1>
        <p className="text-gray-500 text-sm mt-1">
          Asigna el monto de inscripción a los estudiantes registrados y envíalos a Caja
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="card p-5 text-center border-l-4 border-sky-400">
          <p className="text-3xl font-bold text-sky-600">{registered}</p>
          <p className="text-xs text-gray-500 mt-1">Registrados — pendientes de monto</p>
        </div>
        <div className="card p-5 text-center border-l-4 border-orange-400">
          <p className="text-3xl font-bold text-orange-600">{cajaPending}</p>
          <p className="text-xs text-gray-500 mt-1">Enviados a Caja</p>
        </div>
        <div className="card p-5 text-center border-l-4 border-green-400">
          <p className="text-3xl font-bold text-green-600">{confirmed}</p>
          <p className="text-xs text-gray-500 mt-1">Pagos confirmados</p>
        </div>
      </div>

      <div className="card p-6">
        <h2 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
          <Send className="w-4 h-4 text-unphu-600" /> Proceso de cobro
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          {registered > 0
            ? `Hay ${registered} registro${registered > 1 ? 's' : ''} pendiente${registered > 1 ? 's' : ''} de asignación de monto.`
            : 'No hay registros pendientes en este momento.'}
        </p>
        <a
          href="/dashboard/cobros/payments"
          className="inline-flex items-center gap-2 px-4 py-2 bg-unphu-700 hover:bg-unphu-800 text-white text-sm font-medium rounded-lg"
        >
          <CreditCard className="w-4 h-4" /> Gestionar cobros
        </a>
      </div>
    </div>
  );
}
