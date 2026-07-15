'use client';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { thesisApi } from '@/lib/api';
import { STATUS_LABELS } from '@/lib/utils';
import StatusBadge from '@/components/ui/StatusBadge';
import { BarChart3, FileText, Users, TrendingUp } from 'lucide-react';

export default function DirectorDashboard() {
  const { data: metrics } = useQuery({
    queryKey: ['thesis-metrics'],
    queryFn: () => thesisApi.metrics(),
  });

  const { data: works } = useQuery({
    queryKey: ['thesis-works'],
    queryFn: () => thesisApi.list({ limit: 5 }),
  });

  const total = metrics?.total ?? 0;
  const pending = metrics?.byStatus?.find((s: any) => s.status === 'PENDING_PAYMENT')?._count ?? 0;
  const active = metrics?.byStatus?.filter((s: any) =>
    !['APPROVED', 'PUBLISHED', 'REJECTED'].includes(s.status)
  ).reduce((sum: number, s: any) => sum + s._count, 0) ?? 0;
  const published = metrics?.byStatus?.find((s: any) => s.status === 'PUBLISHED')?._count ?? 0;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Panel de Dirección</h1>
        <p className="text-gray-500 text-sm mt-1">Vista general del programa de trabajos de grado</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total registrados', value: total, icon: FileText, color: 'blue' },
          { label: 'En proceso', value: active, icon: TrendingUp, color: 'yellow' },
          { label: 'Pendiente pago', value: pending, icon: Users, color: 'orange' },
          { label: 'Publicados', value: published, icon: BarChart3, color: 'green' },
        ].map((kpi) => (
          <div key={kpi.label} className="card p-5">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{kpi.label}</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{kpi.value}</p>
          </div>
        ))}
      </div>

      <div className="card p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Distribución por estado</h2>
        <div className="space-y-2">
          {metrics?.byStatus?.map((s: any) => (
            <div key={s.status} className="flex items-center gap-3">
              <span className="text-xs text-gray-500 w-48 truncate">{STATUS_LABELS[s.status] ?? s.status.replace(/_/g, ' ')}</span>
              <div className="flex-1 bg-gray-100 rounded-full h-2">
                <div
                  className="bg-unphu-600 h-2 rounded-full"
                  style={{ width: `${total > 0 ? (s._count / total) * 100 : 0}%` }}
                />
              </div>
              <span className="text-xs font-medium text-gray-700 w-6 text-right">{s._count}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Trabajos recientes</h2>
        {works?.data?.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">Sin trabajos registrados</p>
        ) : (
          <div className="space-y-3">
            {works?.data?.map((w: any) => (
              <Link
                key={w.id}
                href={`/dashboard/director/works/${w.id}`}
                className="flex items-center justify-between gap-3 py-2 border-b border-gray-100 last:border-0 hover:bg-gray-50 rounded px-1 transition-colors"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900 line-clamp-1">{w.title}</p>
                  <p className="text-xs text-gray-500">
                    {w.student?.user?.firstName} {w.student?.user?.lastName} · {w.career?.name}
                  </p>
                </div>
                <StatusBadge status={w.status} />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
