'use client';
import { useEffect } from 'react';
import { create } from 'zustand';
import { X, Bell, CheckCircle, AlertCircle, Info } from 'lucide-react';

export interface ToastItem {
  id: string;
  title: string;
  message?: string;
  type?: 'info' | 'success' | 'error' | 'notification';
}

interface ToastStore {
  toasts: ToastItem[];
  add: (toast: Omit<ToastItem, 'id'>) => void;
  remove: (id: string) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  add: (toast) => {
    const id = Math.random().toString(36).slice(2);
    set((s) => ({ toasts: [...s.toasts.slice(-4), { ...toast, id }] }));
  },
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export function toast(item: Omit<ToastItem, 'id'>) {
  useToastStore.getState().add(item);
}

const ICONS = {
  info: Info,
  success: CheckCircle,
  error: AlertCircle,
  notification: Bell,
};
const COLORS = {
  info: 'border-l-blue-500 bg-blue-50 dark:bg-blue-900/20',
  success: 'border-l-green-500 bg-green-50 dark:bg-green-900/20',
  error: 'border-l-red-500 bg-red-50 dark:bg-red-900/20',
  notification: 'border-l-violet-500 bg-violet-50 dark:bg-violet-900/20',
};
const ICON_COLORS = {
  info: 'text-blue-500',
  success: 'text-green-500',
  error: 'text-red-500',
  notification: 'text-violet-500',
};

function ToastCard({ item }: { item: ToastItem }) {
  const { remove } = useToastStore();
  const type = item.type ?? 'notification';
  const Icon = ICONS[type];

  useEffect(() => {
    const t = setTimeout(() => remove(item.id), 5000);
    return () => clearTimeout(t);
  }, [item.id, remove]);

  return (
    <div className={`flex items-start gap-3 p-4 rounded-xl border border-l-4 shadow-lg ${COLORS[type]} border-gray-200 dark:border-gray-700 min-w-72 max-w-sm`}>
      <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${ICON_COLORS[type]}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 dark:text-white">{item.title}</p>
        {item.message && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{item.message}</p>}
      </div>
      <button onClick={() => remove(item.id)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 shrink-0">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

export function ToastContainer() {
  const { toasts } = useToastStore();
  if (toasts.length === 0) return null;
  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto animate-in slide-in-from-right-4 duration-300">
          <ToastCard item={t} />
        </div>
      ))}
    </div>
  );
}
