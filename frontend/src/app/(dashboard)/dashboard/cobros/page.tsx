'use client';
import { useQuery } from '@tanstack/react-query';
import { paymentsApi } from '@/lib/api';
import { CreditCard, CheckCircle, Clock } from 'lucide-react';

export default function CobrosDashboard() {
  const { data: all } = useQuery({
    queryKey: ['cobros-payments-all'],
    queryFn: () => paymentsApi.listAll(),
  });

  const payments = Array.isArray(all) ? all : [];
  const submitted = payments.filter((p: any) => p.status === 'SUBMITTED').length;
  const confirmed = payments.filter((p: any) => p.status === 'CONFIRMED').length;
  const pending = payments.filter((p: any) => p.status === 'PENDING').length;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Departamento de Cobros</h1>
        <p className="text-gray-500 text-sm mt-1">Gestión de comprobantes de pago de matrícula</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="card p-5 text-center">
          <p className="text-3xl font-bold text-yellow-600">{submitted}</p>
          <p className="text-xs text-gray-500 mt-1">Por revisar</p>
        </div>
        <div className="card p-5 text-center">
          <p className="text-3xl font-bold text-green-600">{confirmed}</p>
          <p className="text-xs text-gray-500 mt-1">Confirmados</p>
        </div>
        <div className="card p-5 text-center">
          <p className="text-3xl font-bold text-gray-500">{pending}</p>
          <p className="text-xs text-gray-500 mt-1">Esperando comprobante</p>
        </div>
      </div>

      <div className="card p-6">
        <h2 className="font-semibold text-gray-900 mb-1">Revisión de comprobantes</h2>
        <p className="text-sm text-gray-500 mb-4">
          {submitted > 0
            ? `Hay ${submitted} comprobante${submitted > 1 ? 's' : ''} esperando revisión.`
            : 'No hay comprobantes pendientes de revisión.'}
        </p>
        <a href="/dashboard/cobros/payments"
          className="inline-flex items-center gap-2 px-4 py-2 bg-unphu-700 hover:bg-unphu-800 text-white text-sm font-medium rounded-lg">
          <CreditCard className="w-4 h-4" /> Ver comprobantes
        </a>
      </div>
    </div>
  );
}
