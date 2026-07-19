'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { templatesApi, careersApi } from '@/lib/api';
import {
  ArrowLeft, Plus, Trash2, GripVertical, Save, Star, ChevronDown, ChevronUp,
} from 'lucide-react';

interface NodeDraft {
  id?: string;
  nodeType: string;
  name: string;
  order: number;
  isRequired: boolean;
  isOptional: boolean;
  minWords?: number | '';
  maxWords?: number | '';
  guidance?: string;
  expanded?: boolean;
}

export default function TemplateEditorPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  const { data: template, isLoading } = useQuery({
    queryKey: ['templates', id],
    queryFn: () => templatesApi.get(id),
  });

  const { data: careers = [] } = useQuery({
    queryKey: ['careers'],
    queryFn: () => careersApi.list(),
  });

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [careerId, setCareerId] = useState('');
  const [docType, setDocType] = useState('THESIS');
  const [nodes, setNodes] = useState<NodeDraft[]>([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (template) {
      setName(template.name ?? '');
      setDescription(template.description ?? '');
      setCareerId(template.careerId ?? '');
      setDocType(template.docType ?? 'THESIS');
      setNodes(
        (template.nodes ?? []).map((n: any, i: number) => ({
          id: n.id,
          nodeType: n.nodeType ?? 'section',
          name: n.name,
          order: n.order ?? i,
          isRequired: n.isRequired ?? false,
          isOptional: n.isOptional ?? false,
          minWords: n.metadata?.minWords ?? '',
          maxWords: n.metadata?.maxWords ?? '',
          guidance: n.metadata?.guidance ?? '',
          expanded: false,
        })),
      );
    }
  }, [template]);

  const saveMutation = useMutation({
    mutationFn: () =>
      templatesApi.update(id, {
        name,
        description: description || undefined,
        careerId: careerId || undefined,
        docType,
        nodes: nodes.map((n, i) => ({
          nodeType: n.nodeType || 'section',
          name: n.name,
          order: i,
          isRequired: n.isRequired,
          isOptional: n.isOptional,
          metadata: {
            minWords: n.minWords !== '' ? Number(n.minWords) : undefined,
            maxWords: n.maxWords !== '' ? Number(n.maxWords) : undefined,
            guidance: n.guidance || undefined,
          },
        })),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['templates'] });
      qc.invalidateQueries({ queryKey: ['templates', id] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const setDefaultMutation = useMutation({
    mutationFn: () => templatesApi.setDefault(id, careerId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['templates', id] }),
  });

  const addNode = () => {
    setNodes((prev) => [
      ...prev,
      {
        nodeType: 'section',
        name: 'Nueva sección',
        order: prev.length,
        isRequired: false,
        isOptional: false,
        minWords: '',
        maxWords: '',
        guidance: '',
        expanded: true,
      },
    ]);
  };

  const removeNode = (index: number) => {
    setNodes((prev) => prev.filter((_, i) => i !== index));
  };

  const updateNode = (index: number, patch: Partial<NodeDraft>) => {
    setNodes((prev) => prev.map((n, i) => (i === index ? { ...n, ...patch } : n)));
  };

  const moveNode = (index: number, direction: 'up' | 'down') => {
    const next = [...nodes];
    const swap = direction === 'up' ? index - 1 : index + 1;
    if (swap < 0 || swap >= next.length) return;
    [next[index], next[swap]] = [next[swap], next[index]];
    setNodes(next);
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64 text-gray-500">Cargando...</div>;
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.push('/dashboard/coordinator/templates')}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver a plantillas
        </button>
        <div className="flex items-center gap-2">
          {careerId && (
            <button
              onClick={() => setDefaultMutation.mutate()}
              disabled={setDefaultMutation.isPending || template?.isDefault}
              title="Marcar como plantilla por defecto para esta carrera"
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                template?.isDefault
                  ? 'bg-amber-50 border-amber-300 text-amber-700 dark:bg-amber-900/30 dark:border-amber-600 dark:text-amber-300'
                  : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <Star className={`w-4 h-4 ${template?.isDefault ? 'fill-amber-500 text-amber-500' : ''}`} />
              {template?.isDefault ? 'Por defecto' : 'Marcar por defecto'}
            </button>
          )}
          <button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saveMutation.isPending ? 'Guardando...' : saved ? '¡Guardado!' : 'Guardar'}
          </button>
        </div>
      </div>

      {/* Template metadata */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 space-y-4">
        <h2 className="font-semibold text-gray-900 dark:text-white">Información de la plantilla</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nombre *</label>
            <input
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Carrera</label>
            <select
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              value={careerId}
              onChange={(e) => setCareerId(e.target.value)}
            >
              <option value="">— Sin carrera específica —</option>
              {(careers as any[]).map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tipo de documento</label>
            <select
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
            >
              <option value="THESIS">Tesis</option>
              <option value="ANTEPROYECTO">Anteproyecto</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Descripción</label>
            <input
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Descripción opcional..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Nodes */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900 dark:text-white">
            Secciones <span className="text-gray-400 font-normal text-sm">({nodes.length})</span>
          </h2>
          <button
            onClick={addNode}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-blue-300 dark:border-blue-600 text-blue-600 dark:text-blue-400 rounded-lg text-sm font-medium hover:bg-blue-50 dark:hover:bg-blue-900/20"
          >
            <Plus className="w-4 h-4" />
            Añadir sección
          </button>
        </div>

        {nodes.length === 0 && (
          <div className="text-center py-10 text-gray-400 dark:text-gray-600 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
            Aún no hay secciones. Haz clic en "Añadir sección" para comenzar.
          </div>
        )}

        {nodes.map((node, index) => (
          <div
            key={index}
            className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden"
          >
            {/* Node header row */}
            <div className="flex items-center gap-2 px-4 py-3">
              <GripVertical className="w-4 h-4 text-gray-300 dark:text-gray-600 shrink-0" />
              <span className="text-xs text-gray-400 dark:text-gray-500 font-mono w-6 shrink-0">{index + 1}</span>
              <div className="flex-1 min-w-0">
                <input
                  className="w-full text-sm font-medium text-gray-900 dark:text-white bg-transparent border-none outline-none placeholder-gray-400"
                  value={node.name}
                  onChange={(e) => updateNode(index, { name: e.target.value })}
                  placeholder="Nombre de la sección"
                />
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {node.isRequired && (
                  <span className="text-xs bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded font-medium">
                    Requerida
                  </span>
                )}
                <button
                  onClick={() => moveNode(index, 'up')}
                  disabled={index === 0}
                  className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-20"
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
                <button
                  onClick={() => moveNode(index, 'down')}
                  disabled={index === nodes.length - 1}
                  className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-20"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
                <button
                  onClick={() => updateNode(index, { expanded: !node.expanded })}
                  className="p-1 text-gray-400 hover:text-blue-600 rounded"
                >
                  {node.expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => removeNode(index)}
                  className="p-1 text-gray-400 hover:text-red-600 rounded"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Node details (expanded) */}
            {node.expanded && (
              <div className="border-t border-gray-100 dark:border-gray-700 px-4 py-4 space-y-4 bg-gray-50 dark:bg-gray-800/50">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Tipo de nodo</label>
                    <input
                      className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="section, chapter, appendix..."
                      value={node.nodeType}
                      onChange={(e) => updateNode(index, { nodeType: e.target.value })}
                    />
                  </div>
                  <div className="flex items-center gap-4 pt-5">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={node.isRequired}
                        onChange={(e) => updateNode(index, { isRequired: e.target.checked })}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Requerida</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={node.isOptional}
                        onChange={(e) => updateNode(index, { isOptional: e.target.checked })}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Opcional</span>
                    </label>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Mínimo de palabras</label>
                    <input
                      type="number"
                      className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="Sin límite"
                      value={node.minWords}
                      onChange={(e) => updateNode(index, { minWords: e.target.value === '' ? '' : Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Máximo de palabras</label>
                    <input
                      type="number"
                      className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="Sin límite"
                      value={node.maxWords}
                      onChange={(e) => updateNode(index, { maxWords: e.target.value === '' ? '' : Number(e.target.value) })}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Guía para el estudiante</label>
                  <textarea
                    rows={2}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                    placeholder="Instrucciones o sugerencias para el estudiante sobre qué escribir aquí..."
                    value={node.guidance}
                    onChange={(e) => updateNode(index, { guidance: e.target.value })}
                  />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {nodes.length > 0 && (
        <div className="flex justify-end">
          <button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saveMutation.isPending ? 'Guardando...' : saved ? '¡Guardado!' : 'Guardar plantilla'}
          </button>
        </div>
      )}
    </div>
  );
}
