'use client';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { thesisApi, usersApi } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import StatusBadge from '@/components/ui/StatusBadge';
import {
  Users, FileText, BookOpen, BarChart3, Settings,
  CreditCard, ArrowRight, TrendingUp, Shield,
} from 'lucide-react';

export default function AdminDashboard() {
  const { data: metrics } = useQuery({ queryKey: ['admin-metrics'], queryFn: thesisApi.metrics });
  const { data: recentUsers } = useQuery({
    queryKey: ['recent-users'],
    queryFn: () => usersApi.list({ limit: 5 }),
  });

  const total = metrics?.total || 0;
  const approved = metrics?.byStatus?.find((s: any) => s.status === 'APPROVED')?._count || 0;
  const published = metrics?.byStatus?.find((s: any) => s.status === 'PUBLISHED')?._count || 0;

  const adminLinks = [
    { href: '/dashboard/admin/users', label: 'Gestión de Usuarios', icon: Users, color: 'bg-blue-50 text-blue-600', desc: 'Crear, editar y gestionar roles' },
    { href: '/dashboard/admin/careers', label: 'Carreras', icon: BookOpen, color: 'bg-purple-50 text-purple-600', desc: 'Administrar carreras académicas' },
    { href: '/dashboard/admin/works', label: 'Trabajos de Grado', icon: FileText, color: 'bg-teal-50 text-teal-600', desc: 'Ver y gestionar todos los trabajos' },
    { href: '/dashboard/admin/payments', label: 'Pagos', icon: CreditCard, color: 'bg-orange-50 text-orange-600', desc: 'Confirmar y rechazar comprobantes' },
    { href: '/dashboard/admin/metrics', label: 'Reportes & Métricas', icon: BarChart3, color: 'bg-green-50 text-green-600', desc: 'Estadísticas del sistema' },
    { href: '/dashboard/admin/audit', label: 'Auditoría', icon: Shield, color: 'bg-red-50 text-red-600', desc: 'Bitácora de acciones del sistema' },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Panel de Administración</h1>
        <p className="text-gray-500 text-sm mt-1">Gestión completa del sistema UNPHU Tesis</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total trabajos', value: total, icon: FileText, color: 'text-blue-600 bg-blue-50' },
          { label: 'Aprobados', value: approved, icon: TrendingUp, color: 'text-green-600 bg-green-50' },
          { label: 'Publicados', value: published, icon: BookOpen, color: 'text-teal-600 bg-teal-50' },
          { label: 'Tipos', value: metrics?.byType?.length || 0, icon: BarChart3, color: 'text-purple-600 bg-purple-50' },
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

      {/* Quick access */}
      <div>
        <h2 className="font-semibold text-gray-900 mb-4">Accesos rápidos</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {adminLinks.map((l) => (
            <Link key={l.href} href={l.href} className="card p-5 hover:shadow-md transition-shadow flex items-start gap-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${l.color}`}>
                <l.icon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-medium text-gray-900 text-sm">{l.label}</h3>
                <p className="text-xs text-gray-500 mt-0.5">{l.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Distribución por carrera */}
      {metrics?.byCareer && (
        <div className="card p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Trabajos por carrera</h2>
          <div className="space-y-3">
            {metrics.byCareer.map((c: any) => (
              <div key={c.careerId} className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-unphu-600 rounded-full"
                      style={{ width: `${Math.round((c._count / total) * 100)}%` }}
                    />
                  </div>
                </div>
                <span className="text-sm font-medium text-gray-900 w-8 text-right">{c._count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
