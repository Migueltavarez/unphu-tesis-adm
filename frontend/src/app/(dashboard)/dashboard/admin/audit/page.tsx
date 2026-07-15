'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { auditApi } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { Shield, ChevronLeft, ChevronRight } from 'lucide-react';

const ACTION_COLORS: Record<string, string> = {
  CREATE: 'bg-green-100 text-green-700',
  UPDATE: 'bg-blue-100 text-blue-700',
  DELETE: 'bg-red-100 text-red-700',
  STATUS_CHANGE: 'bg-purple-100 text-purple-700',
  LOGIN: 'bg-gray-100 text-gray-600',
  LOGOUT: 'bg-gray-100 text-gray-600',
};

export default function AdminAuditPage() {
  const [page, setPage] = useState(1);
  const [entity, setEntity] = useState('');
  const [action, setAction] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['audit', entity, action, page],
    queryFn: () => auditApi.list({ entity: entity || undefined, action: action || undefined, page, limit: 25 }),
    placeholderData: (prev) => prev,
  });

  const logs = Array.isArray(data) ? data : data?.data || [];
  const total = data?.total || logs.length;
  const totalPages = Math.ceil(total / 25) || 1;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Bitácora de Auditoría</h1>
        <p className="text-gray-500 text-sm mt-1">Registro de todas las acciones realizadas en el sistema</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <select value={entity} onChange={(e) => { setEntity(e.target.value); setPage(1); }} className="input w-auto text-sm">
          <option value="">Todas las entidades</option>
          <option value="User">Usuarios</option>
          <option value="ThesisWork">Trabajos</option>
          <option value="Payment">Pagos</option>
          <option value="Advance">Avances</option>
          <option value="Career">Carreras</option>
        </select>
        <select value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} className="input w-auto text-sm">
          <option value="">Todas las acciones</option>
          <option value="CREATE">Crear</option>
          <option value="UPDATE">Actualizar</option>
          <option value="DELETE">Eliminar</option>
          <option value="STATUS_CHANGE">Cambio de estado</option>
          <option value="LOGIN">Inicio de sesión</option>
        </select>
      </div>

      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin w-8 h-8 border-2 border-unphu-600 border-t-transparent rounded-full" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Shield className="w-10 h-10 mx-auto mb-2" />
            <p className="text-sm">No hay registros de auditoría</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Acción</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Entidad</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Usuario</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Descripción</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {logs.map((log: any) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <span className={`badge ${ACTION_COLORS[log.action] || 'bg-gray-100 text-gray-600'}`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 font-mono text-xs">{log.entity}</td>
                  <td className="px-4 py-3">
                    <p className="text-gray-900">{log.user?.firstName} {log.user?.lastName}</p>
                    <p className="text-xs text-gray-400">{log.user?.role}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs max-w-xs truncate">{log.description || log.entityId}</td>
                  <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">{formatDate(log.createdAt)}</td>
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
