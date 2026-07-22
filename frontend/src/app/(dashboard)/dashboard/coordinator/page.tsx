'use client';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { thesisApi } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { getCoordinatorAction } from '@/lib/coordinatorActions';
import StatusBadge from '@/components/ui/StatusBadge';
import {
  FileText, Clock, CheckCircle, ArrowRight, BarChart3, CheckCircle2,
} from 'lucide-react';
import { ThesisWork } from '@/types';

export default function CoordinatorDashboard() {
  const { data: metrics } = useQuery({ queryKey: ['metrics'], queryFn: thesisApi.metrics });
  const { data: worksPage } = useQuery({
    queryKey: ['coordinator-works-queue'],
    queryFn: () => thesisApi.list({ page: 1, limit: 50 }),
  });

  const totalWorks = metrics?.total || 0;
  const activeWorks = metrics?.byStatus?.filter(
    (s: any) => !['APPROVED', 'PUBLISHED', 'REJECTED'].includes(s.status)
  ).reduce((a: number, s: any) => a + s._count, 0) || 0;

  // Cola de "requieren tu acción": trabajos donde es el turno del coordinador.
  const actionQueue = (worksPage?.data ?? [])
    .map((w: ThesisWork) => ({ work: w, action: getCoordinatorAction(w.status) }))
    .filter((x: any) => x.action)
    .sort((a: any, b: any) =>
      a.action.order - b.action.order ||
      new Date(a.work.updatedAt).getTime() - new Date(b.work.updatedAt).getTime(),
    );

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Panel de Coordinación</h1>
        <p className="text-gray-500 text-sm mt-1">Gestión integral de trabajos de grado</p>
      </div>

      {/* ── Requieren tu acción ──────────────────────────────────────────── */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <Clock className="w-4 h-4 text-unphu-600" />
            Requieren tu acción
            {actionQueue.length > 0 && (
              <span className="bg-unphu-100 text-unphu-700 text-xs font-bold px-2 py-0.5 rounded-full">
                {actionQueue.length}
              </span>
            )}
          </h2>
          <Link href="/dashboard/coordinator/works" className="text-sm text-unphu-600 hover:underline inline-flex items-center gap-1">
            Ver todos <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {actionQueue.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <CheckCircle2 className="w-12 h-12 mx-auto mb-2 text-green-300" />
            <p className="text-sm font-medium text-gray-600">Todo al día</p>
            <p className="text-xs">No hay trabajos esperando tu acción ahora mismo.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {actionQueue.map(({ work, action }: any) => (
              <Link
                key={work.id}
                href={`/dashboard/coordinator/works/${work.id}`}
                className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 p-3 rounded-xl border border-gray-100 hover:border-unphu-200 hover:bg-unphu-50/40 transition-colors group"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-9 h-9 rounded-lg bg-unphu-100 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-4 h-4 text-unphu-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{work.title}</p>
                    <p className="text-xs text-gray-500 truncate">
                      {work.student?.user?.firstName} {work.student?.user?.lastName} · {work.career?.code} · {formatDate(work.updatedAt)}
                    </p>
                  </div>
                </div>
                <span className="self-start sm:self-auto flex-shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold text-unphu-700 bg-unphu-100 group-hover:bg-unphu-200 rounded-full px-3 py-1.5 transition-colors">
                  {action.label} <ArrowRight className="w-3 h-3" />
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* ── KPIs secundarios ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total trabajos', value: totalWorks, icon: FileText, color: 'text-blue-600 bg-blue-50', href: '/dashboard/coordinator/works' },
          { label: 'En proceso', value: activeWorks, icon: Clock, color: 'text-orange-600 bg-orange-50', href: '/dashboard/coordinator/works' },
          { label: 'Publicados', value: metrics?.byStatus?.find((s: any) => s.status === 'PUBLISHED')?._count || 0, icon: CheckCircle, color: 'text-green-600 bg-green-50', href: '/repository' },
        ].map((s) => (
          <Link key={s.label} href={s.href} className="card p-4 hover:shadow-md transition-shadow">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-2 ${s.color}`}>
              <s.icon className="w-5 h-5" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </Link>
        ))}
      </div>

      {/* ── Distribución por estado ──────────────────────────────────────── */}
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
