'use client';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { thesisApi } from '@/lib/api';
import { STATUS_LABELS, formatDate } from '@/lib/utils';
import StatusBadge from '@/components/ui/StatusBadge';
import { FileText, ArrowRight, Clock, CheckCircle2 } from 'lucide-react';

export default function DirectorDashboard() {
  const { data: metrics } = useQuery({
    queryKey: ['thesis-metrics'],
    queryFn: () => thesisApi.metrics(),
  });

  const { data: works } = useQuery({
    queryKey: ['thesis-works'],
    queryFn: () => thesisApi.list({ limit: 5 }),
  });

  // Cola de "requieren tu acción": anteproyectos esperando revisión del Director.
  const { data: pendingDrafts } = useQuery({
    queryKey: ['director-draft-review'],
    queryFn: () => thesisApi.list({ status: 'DRAFT_UNDER_REVIEW', limit: 50 }),
  });
  const draftQueue = pendingDrafts?.data ?? [];

  const total = metrics?.total ?? 0;
  const active = metrics?.byStatus?.filter((s: any) =>
    !['APPROVED', 'PUBLISHED', 'REJECTED'].includes(s.status)
  ).reduce((sum: number, s: any) => sum + s._count, 0) ?? 0;
  const approved = metrics?.byStatus?.find((s: any) => s.status === 'APPROVED')?._count ?? 0;
  const published = metrics?.byStatus?.find((s: any) => s.status === 'PUBLISHED')?._count ?? 0;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Panel de Dirección</h1>
        <p className="text-gray-500 text-sm mt-1">Vista general del programa de trabajos de grado</p>
      </div>

      {/* ── Requieren tu acción ──────────────────────────────────────────── */}
      <div className="card p-6">
        <h2 className="font-semibold text-gray-900 flex items-center gap-2 mb-4">
          <Clock className="w-4 h-4 text-unphu-600" />
          Requieren tu acción
          {draftQueue.length > 0 && (
            <span className="bg-unphu-100 text-unphu-700 text-xs font-bold px-2 py-0.5 rounded-full">
              {draftQueue.length}
            </span>
          )}
        </h2>

        {draftQueue.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <CheckCircle2 className="w-12 h-12 mx-auto mb-2 text-green-300" />
            <p className="text-sm font-medium text-gray-600">Todo al día</p>
            <p className="text-xs">No hay anteproyectos esperando tu revisión ahora mismo.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {draftQueue.map((w: any) => (
              <Link
                key={w.id}
                href={`/dashboard/director/works/${w.id}`}
                className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 p-3 rounded-xl border border-gray-100 hover:border-unphu-200 hover:bg-unphu-50/40 transition-colors group"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-9 h-9 rounded-lg bg-unphu-100 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-4 h-4 text-unphu-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{w.title}</p>
                    <p className="text-xs text-gray-500 truncate">
                      {w.student?.user?.firstName} {w.student?.user?.lastName} · {w.career?.code} · {formatDate(w.updatedAt)}
                    </p>
                  </div>
                </div>
                <span className="self-start sm:self-auto flex-shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold text-unphu-700 bg-unphu-100 group-hover:bg-unphu-200 rounded-full px-3 py-1.5 transition-colors">
                  Revisar anteproyecto <ArrowRight className="w-3 h-3" />
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* ── KPIs ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total registrados', value: total },
          { label: 'En proceso', value: active },
          { label: 'Aprobados', value: approved },
          { label: 'Publicados', value: published },
        ].map((kpi) => (
          <div key={kpi.label} className="card p-5">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{kpi.label}</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* ── Distribución por estado ──────────────────────────────────────── */}
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

      {/* ── Trabajos recientes ───────────────────────────────────────────── */}
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
                <div className="min-w-0">
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
