'use client';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { thesisApi, studentsApi, advisorsApi, paymentsApi } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import StatusBadge from '@/components/ui/StatusBadge';
import {
  FileText, Users, UserCheck, CreditCard, Clock, CheckCircle,
  AlertCircle, ArrowRight, BarChart3,
} from 'lucide-react';
import { ThesisWork } from '@/types';

export default function CoordinatorDashboard() {
  const { data: metrics } = useQuery({ queryKey: ['metrics'], queryFn: thesisApi.metrics });
  const { data: recentWorks } = useQuery({
    queryKey: ['recent-works'],
    queryFn: () => thesisApi.list({ page: 1, limit: 8 }),
  });
  const { data: pendingPayments } = useQuery({
    queryKey: ['pending-payments'],
    queryFn: () => paymentsApi.listAll('SUBMITTED'),
  });

  const totalWorks = metrics?.total || 0;
  const activeWorks = metrics?.byStatus?.filter(
    (s: any) => !['APPROVED', 'PUBLISHED', 'REJECTED'].includes(s.status)
  ).reduce((a: number, s: any) => a + s._count, 0) || 0;
  const pendingPaymentsCount = pendingPayments?.length || 0;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Panel de Coordinación</h1>
        <p className="text-gray-500 text-sm mt-1">Gestión integral de trabajos de grado</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total trabajos', value: totalWorks, icon: FileText, color: 'text-blue-600 bg-blue-50', href: '/dashboard/coordinator/works' },
          { label: 'En proceso', value: activeWorks, icon: Clock, color: 'text-orange-600 bg-orange-50', href: '/dashboard/coordinator/works' },
          { label: 'Pagos pendientes', value: pendingPaymentsCount, icon: CreditCard, color: 'text-yellow-600 bg-yellow-50', href: '/dashboard/coordinator/payments' },
          { label: 'Publicados', value: metrics?.byStatus?.find((s: any) => s.status === 'PUBLISHED')?._count || 0, icon: CheckCircle, color: 'text-green-600 bg-green-50', href: '/repository' },
        ].map((s) => (
          <Link key={s.label} href={s.href} className="card p-5 hover:shadow-md transition-shadow">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${s.color}`}>
              <s.icon className="w-5 h-5" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </Link>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Trabajos recientes */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Trabajos recientes</h2>
            <Link href="/dashboard/coordinator/works" className="text-sm text-unphu-600 hover:underline inline-flex items-center gap-1">
              Ver todos <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-3">
            {recentWorks?.data?.slice(0, 5).map((w: ThesisWork) => (
              <Link
                key={w.id}
                href={`/dashboard/coordinator/works/${w.id}`}
                className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors"
              >
                <div className="w-9 h-9 rounded-lg bg-unphu-100 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-4 h-4 text-unphu-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{w.title}</p>
                  <p className="text-xs text-gray-500">{w.career?.name} · {formatDate(w.updatedAt)}</p>
                </div>
                <StatusBadge status={w.status} />
              </Link>
            ))}
          </div>
        </div>

        {/* Pagos pendientes de confirmación */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Comprobantes por revisar</h2>
            <Link href="/dashboard/coordinator/payments" className="text-sm text-unphu-600 hover:underline inline-flex items-center gap-1">
              Ver todos <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {pendingPayments?.length === 0 && (
            <div className="text-center py-8 text-gray-400">
              <CheckCircle className="w-10 h-10 mx-auto mb-2 text-green-300" />
              <p className="text-sm">No hay comprobantes pendientes</p>
            </div>
          )}
          <div className="space-y-3">
            {pendingPayments?.slice(0, 5).map((p: any) => (
              <Link
                key={p.id}
                href={`/dashboard/coordinator/payments`}
                className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors"
              >
                <div className="w-9 h-9 rounded-lg bg-yellow-50 flex items-center justify-center">
                  <CreditCard className="w-4 h-4 text-yellow-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {p.thesisWork?.student?.user?.firstName} {p.thesisWork?.student?.user?.lastName}
                  </p>
                  <p className="text-xs text-gray-500">RD$ {Number(p.amount).toLocaleString()} · {formatDate(p.createdAt)}</p>
                </div>
                <span className="badge bg-yellow-100 text-yellow-700">Revisar</span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Distribución por estado */}
      {metrics?.byStatus && (
        <div className="card p-6">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4" /> Distribución por estado
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {metrics.byStatus.map((s: any) => (
              <div key={s.status} className="bg-gray-50 rounded-lg p-3">
                <StatusBadge status={s.status} className="mb-1.5" />
                <p className="text-xl font-bold text-gray-900">{s._count}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
