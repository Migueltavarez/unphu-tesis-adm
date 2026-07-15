'use client';
import { useQuery } from '@tanstack/react-query';
import { thesisApi, repositoryApi } from '@/lib/api';
import StatusBadge from '@/components/ui/StatusBadge';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { BarChart3, FileText, BookOpen, TrendingUp, Download } from 'lucide-react';

export default function AdminMetricsPage() {
  const { data: metrics } = useQuery({ queryKey: ['metrics'], queryFn: thesisApi.metrics });
  const { data: repoStats } = useQuery({ queryKey: ['repo-stats'], queryFn: repositoryApi.stats });
  const { data: monthly } = useQuery({ queryKey: ['monthly-stats'], queryFn: thesisApi.monthlyStats });

  const total = metrics?.total || 0;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reportes y Métricas</h1>
          <p className="text-gray-500 text-sm mt-1">Estadísticas generales del sistema de gestión de tesis</p>
        </div>
        <button
          onClick={() => thesisApi.exportCsv()}
          className="flex items-center gap-2 px-4 py-2 bg-unphu-800 text-white rounded-lg hover:bg-unphu-700 transition-colors text-sm font-medium"
        >
          <Download className="w-4 h-4" />
          Exportar CSV
        </button>
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

      {/* Tendencias mensuales */}
      <div className="card p-6">
        <h2 className="font-semibold text-gray-900 mb-5 flex items-center gap-2">
          <TrendingUp className="w-4 h-4" /> Nuevos trabajos por mes (últimos 12 meses)
        </h2>
        {monthly?.length ? (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={monthly} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorNuevos" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1b3a6b" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#1b3a6b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb', boxShadow: '0 2px 8px rgba(0,0,0,.08)' }}
                formatter={(v: any) => [v, 'Nuevas postulaciones']}
              />
              <Area
                type="monotone"
                dataKey="nuevos"
                stroke="#1b3a6b"
                strokeWidth={2}
                fill="url(#colorNuevos)"
                dot={{ r: 3, fill: '#1b3a6b', strokeWidth: 0 }}
                activeDot={{ r: 5 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-gray-400 text-sm text-center py-12">Sin datos todavía</p>
        )}
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
                .sort((a: any, b: any) => b.count - a.count)
                .map((c: any) => (
                  <div key={c.careerId} className="flex items-center gap-3">
                    <span className="text-sm text-gray-600 w-12 font-mono text-right flex-shrink-0">
                      {c.careerCode || '—'}
                    </span>
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-gold-500 rounded-full" style={{ width: `${total ? Math.round((c.count / total) * 100) : 0}%` }} />
                    </div>
                    <span className="text-sm font-medium text-gray-900 w-8 text-right">{c.count}</span>
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
