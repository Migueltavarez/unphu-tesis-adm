'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { thesisApi } from '@/lib/api';
import { STATUS_LABELS } from '@/lib/utils';
import StatusBadge from '@/components/ui/StatusBadge';
import { FileText, ArrowRight } from 'lucide-react';

export default function DirectorWorksPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['director-works', search, status],
    queryFn: () => thesisApi.list({ search: search || undefined, status: status || undefined, limit: 50 }),
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Trabajos de Grado</h1>
        <p className="text-gray-500 text-sm mt-1">Vista completa del programa (solo lectura)</p>
      </div>

      <div className="flex gap-3 flex-wrap">
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por título o estudiante..." className="input flex-1 min-w-[200px]" />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="input w-48">
          <option value="">Todos los estados</option>
          {Object.entries(STATUS_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin w-8 h-8 border-2 border-unphu-600 border-t-transparent rounded-full" />
        </div>
      ) : data?.data?.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <FileText className="w-12 h-12 mx-auto mb-3 text-gray-200" />
          <p className="text-sm">No hay trabajos con estos filtros</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Título</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Estudiante</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Carrera</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Estado</th>
                <th className="px-4 py-3 w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data?.data?.map((w: any) => (
                <tr key={w.id} className="hover:bg-gray-50 cursor-pointer group">
                  <td className="px-4 py-3 font-medium text-gray-900 max-w-xs">
                    <Link href={`/dashboard/director/works/${w.id}`} className="hover:text-unphu-700 block truncate">
                      {w.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {w.student?.user?.firstName} {w.student?.user?.lastName}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{w.career?.name}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={w.status} />
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/director/works/${w.id}`}
                      className="text-gray-300 group-hover:text-unphu-500 transition-colors">
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
