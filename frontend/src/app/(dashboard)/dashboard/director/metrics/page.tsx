'use client';
import { useQuery } from '@tanstack/react-query';
import { thesisApi } from '@/lib/api';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid,
  RadialBarChart, RadialBar,
} from 'recharts';
import { TrendingUp, GraduationCap, Star, BookOpen } from 'lucide-react';

export default function DirectorMetricsPage() {
  const { data: metrics, isLoading } = useQuery({
    queryKey: ['thesis-metrics'],
    queryFn: () => thesisApi.metrics(),
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  const byYear = (metrics?.byYear ?? []).map((y: any) => ({ year: String(y.year), count: y.count }));
  const careerData = (metrics?.byCareer ?? []).map((c: any) => ({ name: c.careerCode || '?', full: c.careerName, count: c.count }));
  const typeData = (metrics?.byType ?? []).map((t: any) => ({ name: t.type === 'TESIS' ? 'Tesis' : 'Monográfico', count: t._count }));

  const approved = metrics?.funnel?.[4]?.count ?? 0;
  const published = metrics?.funnel?.[5]?.count ?? 0;
  const total = metrics?.total ?? 0;
  const approvalRate = metrics?.approvalRate;
  const grades = metrics?.grades;

  const radialData = [
    { name: 'Aprobación', value: approvalRate ?? 0, fill: '#10b981' },
  ];

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Panel del Director</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Vista ejecutiva del programa de trabajos de grado</p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total registrados', value: total, sub: 'todos los tiempos', icon: GraduationCap, bg: 'bg-blue-600' },
          { label: 'Aprobados', value: approved, sub: `${approvalRate ?? '—'}% tasa`, icon: TrendingUp, bg: 'bg-emerald-600' },
          { label: 'Publicados', value: published, sub: 'en repositorio', icon: BookOpen, bg: 'bg-violet-600' },
          { label: 'Nota promedio', value: grades?.avg ?? '—', sub: grades?.total ? `${grades.total} evaluaciones` : 'sin datos', icon: Star, bg: 'bg-amber-500' },
        ].map(({ label, value, sub, icon: Icon, bg }) => (
          <div key={label} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 flex gap-4 items-start">
            <div className={`${bg} w-10 h-10 rounded-xl flex items-center justify-center shrink-0`}>
              <Icon className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
              <p className="text-xs font-medium text-gray-700 dark:text-gray-200">{label}</p>
              <p className="text-xs text-gray-400">{sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Funnel + Tasa */}
      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-5">Embudo de progreso académico</h2>
          <div className="space-y-3">
            {(metrics?.funnel ?? []).map((stage: any, i: number) => {
              const max = metrics?.funnel?.[0]?.count || 1;
              const pct = Math.round((stage.count / max) * 100);
              const colors = ['bg-slate-300 dark:bg-slate-600', 'bg-blue-300', 'bg-blue-400', 'bg-violet-400', 'bg-emerald-500', 'bg-emerald-700'];
              return (
                <div key={stage.stage} className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 dark:text-gray-400 w-28 shrink-0">{stage.stage}</span>
                  <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-6 overflow-hidden">
                    <div className={`h-6 ${colors[i]} rounded-full flex items-center justify-end pr-2 transition-all`}
                      style={{ width: `${Math.max(pct, 4)}%` }}>
                      <span className="text-xs font-semibold text-white">{stage.count}</span>
                    </div>
                  </div>
                  <span className="text-xs text-gray-400 w-8 text-right">{pct}%</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 flex flex-col items-center justify-center">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-2 self-start">Tasa de aprobación</h2>
          {approvalRate != null ? (
            <>
              <ResponsiveContainer width="100%" height={140}>
                <RadialBarChart cx="50%" cy="50%" innerRadius="55%" outerRadius="90%"
                  data={radialData} startAngle={90} endAngle={90 - (approvalRate * 3.6)}>
                  <RadialBar dataKey="value" fill="#10b981" background={{ fill: '#f3f4f6' }} cornerRadius={8} />
                </RadialBarChart>
              </ResponsiveContainer>
              <p className="text-4xl font-bold text-emerald-600 -mt-8">{approvalRate}%</p>
              <p className="text-xs text-gray-400 mt-2">aprobados / (aprobados + rechazados)</p>
            </>
          ) : (
            <p className="text-gray-400 text-sm">Sin datos suficientes</p>
          )}
        </div>
      </div>

      {/* By year + by career */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-5">Trabajos por año</h2>
          {byYear.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Sin datos</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={byYear}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip formatter={(v: any) => [v, 'Trabajos']} />
                <Line type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-5">Por carrera</h2>
          {careerData.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Sin datos</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={careerData} layout="vertical" margin={{ left: 4, right: 24 }}>
                <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={36} />
                <Tooltip formatter={(v: any) => [v, 'Trabajos']} labelFormatter={(l: any) => careerData.find((c: any) => c.name === l)?.full ?? l} />
                <Bar dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Grade stats + type */}
      <div className="grid md:grid-cols-2 gap-6">
        {grades?.total > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Estadísticas de calificaciones</h2>
            <div className="grid grid-cols-3 gap-4 text-center">
              {[
                { label: 'Promedio', value: grades.avg ?? '—', color: 'text-blue-600' },
                { label: 'Mínima', value: grades.min ?? '—', color: 'text-amber-600' },
                { label: 'Máxima', value: grades.max ?? '—', color: 'text-emerald-600' },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                  <p className={`text-2xl font-bold ${color}`}>{value}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{label}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 text-center mt-3">{grades.total} evaluaciones registradas</p>
          </div>
        )}

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Por tipo de trabajo</h2>
          <div className="space-y-3 mt-2">
            {typeData.map((t: any) => {
              const pct = total > 0 ? Math.round((t.count / total) * 100) : 0;
              return (
                <div key={t.name}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-700 dark:text-gray-300">{t.name}</span>
                    <span className="font-semibold text-gray-900 dark:text-white">{t.count} <span className="text-gray-400 font-normal">({pct}%)</span></span>
                  </div>
                  <div className="bg-gray-100 dark:bg-gray-700 rounded-full h-2.5">
                    <div className="h-2.5 rounded-full bg-amber-400" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
