'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { repositoryApi, careersApi } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { Search, BookOpen, Download, GraduationCap, Filter, ArrowLeft } from 'lucide-react';

export default function RepositoryPage() {
  const [search, setSearch] = useState('');
  const [careerId, setCareerId] = useState('');
  const [year, setYear] = useState('');
  const [page, setPage] = useState(1);

  const { data: careers } = useQuery({ queryKey: ['careers'], queryFn: careersApi.list });
  const { data: results, isLoading } = useQuery({
    queryKey: ['repository', search, careerId, year, page],
    queryFn: () => repositoryApi.list({ search: search || undefined, careerId: careerId || undefined, year: year ? Number(year) : undefined, page, limit: 12 }),
    staleTime: 30_000,
  });
  const { data: stats } = useQuery({ queryKey: ['repo-stats'], queryFn: repositoryApi.stats });

  const years = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-unphu-gradient text-white py-16">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <Link href="/" className="inline-flex items-center gap-2 text-unphu-200 hover:text-white text-sm mb-6 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Inicio
          </Link>
          <h1 className="text-3xl md:text-4xl font-bold mb-3">
            Repositorio Digital de Tesis
          </h1>
          <p className="text-unphu-200 mb-8">
            Consulta los trabajos de grado aprobados de la Facultad de Ingeniería UNPHU
          </p>

          {/* Stats */}
          <div className="flex justify-center gap-8 text-sm">
            <div><span className="text-2xl font-bold">{stats?.total || 0}</span><p className="text-unphu-300">Trabajos publicados</p></div>
            <div><span className="text-2xl font-bold">{stats?.byCareer?.length || 0}</span><p className="text-unphu-300">Carreras</p></div>
            <div><span className="text-2xl font-bold">{stats?.byYear?.length || 0}</span><p className="text-unphu-300">Años</p></div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-10">
        {/* Filtros */}
        <div className="card p-5 mb-8 flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por título, autor, palabras clave..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="input pl-9"
            />
          </div>
          <select
            value={careerId}
            onChange={(e) => { setCareerId(e.target.value); setPage(1); }}
            className="input md:w-56"
          >
            <option value="">Todas las carreras</option>
            {careers?.map((c: any) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <select
            value={year}
            onChange={(e) => { setYear(e.target.value); setPage(1); }}
            className="input md:w-32"
          >
            <option value="">Todos los años</option>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        {/* Results */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin w-10 h-10 border-2 border-unphu-600 border-t-transparent rounded-full" />
          </div>
        ) : results?.data?.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <BookOpen className="w-14 h-14 mx-auto mb-4" />
            <p className="text-lg font-medium">No se encontraron resultados</p>
            <p className="text-sm mt-1">Intenta con otros términos de búsqueda</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {results?.data?.map((work: any) => (
              <Link
                key={work.id}
                href={`/repository/${work.id}`}
                className="card p-6 hover:shadow-md transition-all hover:-translate-y-0.5 block"
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-unphu-800 flex items-center justify-center flex-shrink-0">
                    <GraduationCap className="w-5 h-5 text-gold-400" />
                  </div>
                  <div>
                    <span className="badge bg-blue-50 text-blue-700 text-xs mb-1">
                      {work.type === 'TESIS' ? 'Tesis' : 'Monográfico'}
                    </span>
                    <p className="text-xs text-gray-500">{work.career?.name}</p>
                  </div>
                </div>

                <h3 className="font-semibold text-gray-900 text-sm mb-2 line-clamp-2">{work.title}</h3>
                {work.abstract && (
                  <p className="text-xs text-gray-500 line-clamp-3 mb-3">{work.abstract}</p>
                )}

                {work.keywords?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {work.keywords.slice(0, 3).map((k: string) => (
                      <span key={k} className="badge bg-gray-100 text-gray-600 text-xs">{k}</span>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                  <div>
                    <p className="text-xs font-medium text-gray-700">
                      {work.student?.user?.firstName} {work.student?.user?.lastName}
                    </p>
                    <p className="text-xs text-gray-400">{work.year}</p>
                  </div>
                  {work.documents?.length > 0 && (
                    <span className="inline-flex items-center gap-1 text-unphu-600 text-xs font-medium">
                      <Download className="w-3.5 h-3.5" /> PDF
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Paginación */}
        {results && results.totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 mt-10">
            <button
              onClick={() => setPage(page - 1)}
              disabled={page === 1}
              className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed px-3 py-1.5 text-sm"
            >
              Anterior
            </button>
            <span className="text-sm text-gray-500">
              Página {page} de {results.totalPages}
            </span>
            <button
              onClick={() => setPage(page + 1)}
              disabled={page === results.totalPages}
              className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed px-3 py-1.5 text-sm"
            >
              Siguiente
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
