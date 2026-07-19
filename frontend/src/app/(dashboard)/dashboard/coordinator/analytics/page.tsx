'use client';
import { useQuery } from '@tanstack/react-query';
import { thesisApi } from '@/lib/api';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { TrendingUp, Users, CheckCircle, Clock, BookOpen, GraduationCap } from 'lucide-react';

const STATUS_GROUPS: Record<string, { label: string; color: string }> = {
  POSTULATION:           { label: 'Postulación',        color: '#94a3b8' },
  ACADEMIC_VALIDATION:   { label: 'Validación',         color: '#94a3b8' },
  PROPOSAL_FORM:         { label: 'Propuesta',          color: '#94a3b8' },
  PENDING_PAYMENT:       { label: 'Pago pendiente',     color: '#fbbf24' },
  PAYMENT_CONFIRMED:     { label: 'Pago confirmado',    color: '#a78bfa' },
  FACULTY_MEETING:       { label: 'Reunión facultad',   color: '#a78bfa' },
  DRAFT_IN_PROGRESS:     { label: 'Borrador',           color: '#60a5fa' },
  DRAFT_UNDER_REVIEW:    { label: 'Revisión borrador',  color: '#60a5fa' },
  DRAFT_APPROVED:        { label: 'Borrador aprobado',  color: '#60a5fa' },
  ADVISOR_ASSIGNED:      { label: 'Asesor asignado',    color: '#34d399' },
  WORK_STARTED:          { label: 'Iniciado',           color: '#34d399' },
  IN_DEVELOPMENT:        { label: 'En desarrollo',      color: '#34d399' },
  ADVANCES_SUBMITTED:    { label: 'Avances enviados',   color: '#34d399' },
  ADVISOR_FEEDBACK:      { label: 'Retroalimentación',  color: '#34d399' },
  WORK_COMPLETED:        { label: 'Completado',         color: '#10b981' },
  PRESENTATION_SCHEDULED:{ label: 'Pres. programada',   color: '#8b5cf6' },
  PRESENTATION_DONE:     { label: 'Pres. realizada',    color: '#8b5cf6' },
  GRADED:                { label: 'Calificado',         color: '#8b5cf6' },
  APPROVED:              { label: 'Aprobado',           color: '#059669' },
  PUBLISHED:             { label: 'Publicado',          color: '#065f46' },
  REJECTED:              { label: 'Rechazado',          color: '#ef4444' },
};

const SECTION_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Borrador',
  IN_PROGRESS: 'En progreso',
  PENDING_REVIEW: 'Pendiente revisión',
  RETURNED: 'Devuelta',
  APPROVED: 'Aprobada',
};
const SECTION_COLORS = ['#94a3b8', '#60a5fa', '#fbbf24', '#f87171', '#34d399'];

export default function CoordinatorAnalyticsPage() {
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

  const statusData = (metrics?.byStatus ?? []).map((s: any) => ({
    name: STATUS_GROUPS[s.status]?.label ?? s.status,
    value: s._count,
    color: STATUS_GROUPS[s.status]?.color ?? '#94a3b8',
  })).sort((a: any, b: any) => b.value - a.value);

  const careerData = (metrics?.byCareer ?? []).map((c: any) => ({
    name: c.careerCode || c.careerName?.split(' ').map((w: string) => w[0]).join('') || '?',
    fullName: c.careerName,
    count: c.count,
  })).sort((a: any, b: any) => b.count - a.count);

  const sectionPieData = (metrics?.sections?.byStatus ?? []).map((s: any, i: number) => ({
    name: SECTION_STATUS_LABELS[s.status] ?? s.status,
    value: s.count,
    color: SECTION_COLORS[i % SECTION_COLORS.length],
  }));

  const active = metrics?.funnel?.[1]?.count ?? 0;

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Analytics del programa</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Métricas en tiempo real de trabajos de grado</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total registrados', value: metrics?.total ?? 0, icon: GraduationCap, color: 'blue' },
          { label: 'En desarrollo', value: active, icon: Clock, color: 'amber' },
          { label: 'Aprobados', value: metrics?.funnel?.[4]?.count ?? 0, icon: CheckCircle, color: 'green' },
          { label: 'Tasa aprobación', value: metrics?.approvalRate != null ? `${metrics.approvalRate}%` : '—', icon: TrendingUp, color: 'purple' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${
              color === 'blue' ? 'bg-blue-50 dark:bg-blue-900/30' :
              color === 'amber' ? 'bg-amber-50 dark:bg-amber-900/30' :
              color === 'green' ? 'bg-green-50 dark:bg-green-900/30' :
              'bg-purple-50 dark:bg-purple-900/30'
            }`}>
              <Icon className={`w-5 h-5 ${
                color === 'blue' ? 'text-blue-600' :
                color === 'amber' ? 'text-amber-600' :
                color === 'green' ? 'text-green-600' :
                'text-purple-600'
              }`} />
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Funnel */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="font-semibold text-gray-900 dark:text-white mb-5">Embudo de progreso</h2>
        <div className="flex items-end gap-2">
          {(metrics?.funnel ?? []).map((stage: any, i: number) => {
            const max = metrics?.funnel?.[0]?.count || 1;
            const pct = Math.round((stage.count / max) * 100);
            const colors = ['bg-slate-400', 'bg-blue-400', 'bg-blue-500', 'bg-violet-500', 'bg-emerald-500', 'bg-emerald-700'];
            return (
              <div key={stage.stage} className="flex-1 flex flex-col items-center gap-2">
                <span className="text-lg font-bold text-gray-900 dark:text-white">{stage.count}</span>
                <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-t-sm" style={{ height: 120 }}>
                  <div
                    className={`w-full ${colors[i]} rounded-t-sm transition-all`}
                    style={{ height: `${pct}%`, marginTop: `${100 - pct}%` }}
                  />
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400 text-center leading-tight">{stage.stage}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* By career */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-5">Trabajos por carrera</h2>
          {careerData.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Sin datos</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={careerData} layout="vertical" margin={{ left: 8, right: 24 }}>
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={40} />
                <Tooltip
                  formatter={(v: any) => [v, 'Trabajos']}
                  labelFormatter={(l: any) => careerData.find((c: any) => c.name === l)?.fullName ?? l}
                />
                <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Section status pie */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-1">Estado de secciones</h2>
          <p className="text-xs text-gray-400 mb-4">
            {metrics?.sections?.approved ?? 0} de {metrics?.sections?.total ?? 0} secciones aprobadas
          </p>
          {sectionPieData.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Sin datos</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={sectionPieData} cx="50%" cy="50%" outerRadius={70} dataKey="value" nameKey="name">
                  {sectionPieData.map((entry: any, index: number) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: any, n: any) => [v, n]} />
                <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* By status breakdown */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Distribución por estado</h2>
        <div className="space-y-2">
          {statusData.filter((s: any) => s.value > 0).map((s: any) => {
            const pct = metrics?.total > 0 ? Math.round((s.value / metrics.total) * 100) : 0;
            return (
              <div key={s.name} className="flex items-center gap-3">
                <span className="text-xs text-gray-600 dark:text-gray-400 w-44 truncate shrink-0">{s.name}</span>
                <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                  <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: s.color }} />
                </div>
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 w-8 text-right">{s.value}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
