'use client';
import { useQuery } from '@tanstack/react-query';
import { thesisApi, repositoryApi } from '@/lib/api';
import StatusBadge from '@/components/ui/StatusBadge';
import { BarChart3, FileText, BookOpen, TrendingUp, Users } from 'lucide-react';

export default function AdminMetricsPage() {
  const { data: metrics } = useQuery({ queryKey: ['metrics'], queryFn: thesisApi.metrics });
  const { data: repoStats } = useQuery({ queryKey: ['repo-stats'], queryFn: repositoryApi.stats });

  const total = metrics?.total || 0;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reportes y Métricas</h1>
        <p className="text-gray-500 text-sm mt-1">Estadísticas generales del sistema de gestión de tesis</p>
      </div>

      {/* Top KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total trabajos', value: total, icon: FileText, color: 'text-blue-600 bg-blue-50' },
          { label: 'Publicados', value: repoStats?.total || metrics?.byStatus?.find((s: any) => s.status === 'PUBLISHED')?._count || 0, icon: BookOpen, color: 'text-green-600 bg-green-50' },
          { label: 'Aprobados', value: metrics?.byStatus?.find((s: any) => s.status === 'APPROVED')?._count || 0, icon: TrendingUp, color: 'text-teal-600 bg-teal-50' },
          { label: 'Rechazados', value: metrics?.byStatus?.find((s: any) => s.status === 'REJECTED')?._count || 0, icon: BarChart3, color: 'text-red-600 bg-red-50' },
        ].map((s) => (
          <div key={s.label} className="card p-5">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${s.color}`}>
              <s.icon className="w-5 h-5" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Por estado */}
        <div className="card p-6">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4" /> Distribución por estado
          </h2>
          {metrics?.byStatus?.length ? (
            <div className="space-y-3">
              {metrics.byStatus
                .filter((s: any) => s._count > 0)
                .sort((a: any, b: any) => b._count - a._count)
                .map((s: any) => (
                  <div key={s.status} className="flex items-center gap-3">
                    <StatusBadge status={s.status} />
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-unphu-500 rounded-full" style={{ width: `${total ? Math.round((s._count / total) * 100) : 0}%` }} />
                    </div>
                    <span className="text-sm font-medium text-gray-900 w-8 text-right">{s._count}</span>
                  </div>
                ))}
            </div>
          ) : (
            <p className="text-gray-400 text-sm text-center py-8">Sin datos todavía</p>
          )}
        </div>

        {/* Por carrera */}
        <div className="card p-6">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <BookOpen className="w-4 h-4" /> Trabajos por carrera
          </h2>
          {metrics?.byCareer?.length ? (
            <div className="space-y-3">
              {metrics.byCareer
                .sort((a: any, b: any) => b._count - a._count)
                .map((c: any) => (
                  <div key={c.careerId} className="flex items-center gap-3">
                    <span className="text-sm text-gray-600 w-12 font-mono text-right flex-shrink-0">
                      {c.career?.code || '—'}
                    </span>
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-gold-500 rounded-full" style={{ width: `${total ? Math.round((c._count / total) * 100) : 0}%` }} />
                    </div>
                    <span className="text-sm font-medium text-gray-900 w-8 text-right">{c._count}</span>
                  </div>
                ))}
            </div>
          ) : (
            <p className="text-gray-400 text-sm text-center py-8">Sin datos todavía</p>
          )}
        </div>

        {/* Por tipo */}
        {metrics?.byType && (
          <div className="card p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Tipo de trabajo</h2>
            <div className="flex gap-6">
              {metrics.byType.map((t: any) => (
                <div key={t.type} className="text-center">
                  <p className="text-3xl font-bold text-gray-900">{t._count}</p>
                  <p className="text-sm text-gray-500 mt-1">{t.type === 'TESIS' ? 'Tesis' : 'Monográficos'}</p>
                  <p className="text-xs text-gray-400">{total ? Math.round((t._count / total) * 100) : 0}%</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Repositorio */}
        {repoStats && (
          <div className="card p-6">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <BookOpen className="w-4 h-4" /> Repositorio público
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-2xl font-bold text-gray-900">{repoStats.total}</p>
                <p className="text-xs text-gray-500">Trabajos publicados</p>
              </div>
              {repoStats.byCareer?.slice(0, 4).map((c: any) => (
                <div key={c.careerId}>
                  <p className="text-xl font-bold text-gray-900">{c._count}</p>
                  <p className="text-xs text-gray-500">{c.career?.code}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
