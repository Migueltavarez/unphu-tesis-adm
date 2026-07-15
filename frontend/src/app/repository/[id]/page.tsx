'use client';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { repositoryApi } from '@/lib/api';
import { formatDate, formatFileSize } from '@/lib/utils';
import { ArrowLeft, Download, User, BookOpen, Calendar, Tag, GraduationCap } from 'lucide-react';

export default function ThesisDetailPage({ params }: { params: { id: string } }) {
  const { data: work, isLoading } = useQuery({
    queryKey: ['repository', params.id],
    queryFn: () => repositoryApi.get(params.id),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-10 h-10 border-2 border-unphu-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!work) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500">Trabajo no encontrado o no publicado.</p>
          <Link href="/repository" className="text-unphu-600 hover:underline mt-2 block">
            Volver al repositorio
          </Link>
        </div>
      </div>
    );
  }

  const avgGrade = work.grades?.length
    ? (work.grades.reduce((s: number, g: any) => s + (g.finalGrade || 0), 0) / work.grades.length).toFixed(1)
    : null;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-unphu-800 text-white py-12">
        <div className="max-w-4xl mx-auto px-6">
          <Link href="/repository" className="inline-flex items-center gap-2 text-unphu-300 hover:text-white text-sm mb-6 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Repositorio
          </Link>
          <span className="badge bg-gold-400 text-unphu-900 mb-3">
            {work.type === 'TESIS' ? 'Tesis' : 'Monográfico'}
          </span>
          <h1 className="text-2xl md:text-3xl font-bold mt-2 mb-4">{work.title}</h1>
          <div className="flex flex-wrap gap-4 text-sm text-unphu-300">
            <span className="flex items-center gap-1.5"><User className="w-4 h-4" />
              {work.student?.user?.firstName} {work.student?.user?.lastName}
            </span>
            <span className="flex items-center gap-1.5"><BookOpen className="w-4 h-4" /> {work.career?.name}</span>
            <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4" /> {work.year}</span>
            {avgGrade && <span className="text-gold-400 font-medium">Nota: {avgGrade}/100</span>}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-10 grid md:grid-cols-3 gap-8">
        {/* Main */}
        <div className="md:col-span-2 space-y-6">
          {work.abstract && (
            <div className="card p-6">
              <h2 className="font-semibold text-gray-900 mb-3">Resumen</h2>
              <p className="text-gray-600 text-sm leading-relaxed">{work.abstract}</p>
            </div>
          )}

          {work.keywords?.length > 0 && (
            <div className="card p-6">
              <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Tag className="w-4 h-4" /> Palabras clave
              </h2>
              <div className="flex flex-wrap gap-2">
                {work.keywords.map((k: string) => (
                  <span key={k} className="badge bg-unphu-50 text-unphu-700">{k}</span>
                ))}
              </div>
            </div>
          )}

          {/* Documentos descargables */}
          {work.documents?.length > 0 && (
            <div className="card p-6">
              <h2 className="font-semibold text-gray-900 mb-4">Documentos</h2>
              <div className="space-y-3">
                {work.documents.map((doc: any) => (
                  <a
                    key={doc.id}
                    href={doc.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-4 p-4 bg-gray-50 hover:bg-blue-50 rounded-xl border border-gray-200 hover:border-blue-200 transition-colors group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
                      <BookOpen className="w-5 h-5 text-red-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{doc.name}</p>
                      {doc.fileSize && <p className="text-xs text-gray-400">{formatFileSize(doc.fileSize)}</p>}
                    </div>
                    <Download className="w-4 h-4 text-gray-400 group-hover:text-unphu-600 transition-colors" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          <div className="card p-5">
            <h3 className="font-semibold text-gray-900 mb-4 text-sm">Información</h3>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-gray-400 text-xs">Autor</dt>
                <dd className="font-medium text-gray-900">{work.student?.user?.firstName} {work.student?.user?.lastName}</dd>
              </div>
              <div>
                <dt className="text-gray-400 text-xs">Matrícula</dt>
                <dd className="font-medium text-gray-900">{work.student?.matricula}</dd>
              </div>
              {work.advisor && (
                <div>
                  <dt className="text-gray-400 text-xs">Asesor</dt>
                  <dd className="font-medium text-gray-900">{work.advisor.user?.firstName} {work.advisor.user?.lastName}</dd>
                </div>
              )}
              <div>
                <dt className="text-gray-400 text-xs">Carrera</dt>
                <dd className="font-medium text-gray-900">{work.career?.name}</dd>
              </div>
              <div>
                <dt className="text-gray-400 text-xs">Año</dt>
                <dd className="font-medium text-gray-900">{work.year}</dd>
              </div>
              {work.publishedAt && (
                <div>
                  <dt className="text-gray-400 text-xs">Publicado</dt>
                  <dd className="font-medium text-gray-900">{formatDate(work.publishedAt)}</dd>
                </div>
              )}
            </dl>
          </div>

          {avgGrade && (
            <div className="card p-5 text-center bg-green-50 border-green-200">
              <p className="text-xs text-green-600 mb-1">Calificación final</p>
              <p className="text-3xl font-bold text-green-700">{avgGrade}</p>
              <p className="text-xs text-green-500">/ 100 puntos</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
