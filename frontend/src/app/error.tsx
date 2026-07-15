'use client';
import { useEffect } from 'react';
import { GraduationCap, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-12 h-12 bg-unphu-800 rounded-xl flex items-center justify-center">
            <GraduationCap className="w-6 h-6 text-gold-400" />
          </div>
          <div className="text-left">
            <p className="font-bold text-unphu-900 text-lg leading-none">UNPHU</p>
            <p className="text-sm text-gray-500">Gestión de Tesis</p>
          </div>
        </div>

        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <span className="text-3xl font-black text-red-500">!</span>
        </div>
        <h2 className="text-2xl font-semibold text-gray-800 mb-3">Algo salió mal</h2>
        <p className="text-gray-500 mb-8">
          Ocurrió un error inesperado. Puedes intentar recargar la página o regresar al inicio.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={reset}
            className="flex items-center gap-2 px-5 py-2.5 bg-unphu-800 text-white rounded-lg hover:bg-unphu-700 transition-colors text-sm font-medium"
          >
            <RefreshCw className="w-4 h-4" />
            Intentar de nuevo
          </button>
          <Link
            href="/"
            className="flex items-center gap-2 px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors text-sm font-medium"
          >
            <Home className="w-4 h-4" />
            Ir al inicio
          </Link>
        </div>
      </div>
    </div>
  );
}
