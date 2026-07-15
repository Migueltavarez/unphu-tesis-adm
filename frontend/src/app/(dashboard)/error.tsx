'use client';
import { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function DashboardError({
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
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mb-4">
        <AlertTriangle className="w-7 h-7 text-red-500" />
      </div>
      <h2 className="text-xl font-semibold text-gray-800 mb-2">Error al cargar</h2>
      <p className="text-gray-500 mb-6 max-w-sm">
        No se pudo cargar esta sección. Por favor intenta de nuevo.
      </p>
      <button
        onClick={reset}
        className="flex items-center gap-2 px-4 py-2 bg-unphu-800 text-white rounded-lg hover:bg-unphu-700 transition-colors text-sm font-medium"
      >
        <RefreshCw className="w-4 h-4" />
        Reintentar
      </button>
    </div>
  );
}
