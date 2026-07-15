'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { thesisApi, careersApi } from '@/lib/api';
import { formatDate, STATUS_LABELS } from '@/lib/utils';
import StatusBadge from '@/components/ui/StatusBadge';
import { Search, FileText, ChevronLeft, ChevronRight, Download } from 'lucide-react';

const STATUS_OPTIONS = [
  { value: '', label: 'Todos los estados' },
  { value: 'POSTULATION_SUBMITTED', label: 'Postulación enviada' },
  { value: 'IN_PROGRESS', label: 'En progreso' },
  { value: 'FINAL_REVIEW', label: 'Revisión final' },
  { value: 'APPROVED', label: 'Aprobado' },
  { value: 'PUBLISHED', label: 'Publicado' },
  { value: 'REJECTED', label: 'Rechazado' },
];

export default function AdminWorksPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [careerId, setCareerId] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-works', search, status, careerId, page],
    queryFn: () => thesisApi.list({ search, status, careerId, page, limit: 20 }),
    placeholderData: (prev) => prev,
  });

  const { data: careers } = useQuery({ queryKey: ['careers'], queryFn: careersApi.list });
  const totalPages = data ? Math.ceil(data.total / 20) : 1;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Todos los trabajos</h1>
          <p className="text-gray-500 text-sm mt-1">{data?.total ?? 0} trabajos en el sistema</p>
        </div>
        <button
          onClick={() => thesisApi.exportCsv()}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
        >
          <Download className="w-4 h-4" /> Exportar CSV
        </button>
      </div>

      <div className="card p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Buscar por título o estudiante..." className="input pl-9 text-sm" />
        </div>
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="input w-auto text-sm">
          {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select value={careerId} onChange={(e) => { setCareerId(e.target.value); setPage(1); }} className="input w-auto text-sm">
          <option value="">Todas las carreras</option>
          {careers?.map((c: any) => <option key={c.id} value={c.id}>{c.code}</option>)}
        </select>
      </div>

      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin w-8 h-8 border-2 border-unphu-600 border-t-transparent rounded-full" />
          </div>
        ) : data?.data?.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <FileText className="w-10 h-10 mx-auto mb-2" />
            <p className="text-sm">No se encontraron trabajos</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Título</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Estudiante</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Carrera</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Estado</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Asesor</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Actualizado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data?.data?.map((w: any) => (
                <tr key={w.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/coordinator/works/${w.id}`} className="font-medium text-gray-900 hover:text-unphu-700 line-clamp-1">
                      {w.title}
                    </Link>
                    <p className="text-xs text-gray-400">{w.type === 'TESIS' ? 'Tesis' : 'Monográfico'} · {w.year}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {w.student?.user?.firstName} {w.student?.user?.lastName}
                    <p className="text-xs text-gray-400">{w.student?.matricula}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{w.career?.code || '—'}</td>
                  <td className="px-4 py-3"><StatusBadge status={w.status} /></td>
                  <td className="px-4 py-3 text-gray-600">
                    {w.advisor ? `${w.advisor.user?.firstName} ${w.advisor.user?.lastName}` : <span className="text-gray-400">Sin asignar</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">{formatDate(w.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-xs text-gray-500">Página {page} de {totalPages}</p>
            <div className="flex gap-1">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                className="p-1.5 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="p-1.5 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
