'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Cookies from 'js-cookie';
import { useQuery } from '@tanstack/react-query';
import {
  GraduationCap, LayoutDashboard, FileText, Upload, CreditCard,
  Users, BookOpen, Bell, LogOut, Menu, X, ChevronRight,
  UserCheck, BarChart3, Settings, Search,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { notificationsApi } from '@/lib/api';
import { cn, getInitials } from '@/lib/utils';
import { UserRole } from '@/types';
import { ToastContainer } from '@/components/ui/Toast';
import { useNotificationSSE } from '@/hooks/useNotificationSSE';

interface NavItem {
  href: string;
  label: string;
  icon: any;
  roles: UserRole[];
}

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard/student', label: 'Mi Panel', icon: LayoutDashboard, roles: ['STUDENT'] },
  { href: '/dashboard/student/thesis', label: 'Mi Trabajo', icon: FileText, roles: ['STUDENT'] },
  { href: '/dashboard/student/document', label: 'Editor de Tesis', icon: BookOpen, roles: ['STUDENT'] },
  { href: '/dashboard/student/advances', label: 'Mis Avances', icon: Upload, roles: ['STUDENT'] },
  { href: '/dashboard/student/payment', label: 'Pago', icon: CreditCard, roles: ['STUDENT'] },

  { href: '/dashboard/advisor', label: 'Mi Panel', icon: LayoutDashboard, roles: ['ADVISOR'] },
  { href: '/dashboard/advisor/works', label: 'Trabajos Asignados', icon: FileText, roles: ['ADVISOR'] },
  { href: '/dashboard/advisor/profile', label: 'Mi Perfil', icon: UserCheck, roles: ['ADVISOR'] },

  { href: '/dashboard/coordinator', label: 'Panel', icon: LayoutDashboard, roles: ['COORDINATOR'] },
  { href: '/dashboard/coordinator/works', label: 'Todos los Trabajos', icon: FileText, roles: ['COORDINATOR'] },
  { href: '/dashboard/coordinator/students', label: 'Estudiantes', icon: Users, roles: ['COORDINATOR'] },
  { href: '/dashboard/coordinator/advisors', label: 'Asesores', icon: UserCheck, roles: ['COORDINATOR'] },
  { href: '/dashboard/coordinator/payments', label: 'Pagos', icon: CreditCard, roles: ['COORDINATOR'] },
  { href: '/dashboard/coordinator/templates', label: 'Plantillas', icon: BookOpen, roles: ['COORDINATOR'] },
  { href: '/dashboard/coordinator/analytics', label: 'Analíticas', icon: BarChart3, roles: ['COORDINATOR'] },

  { href: '/dashboard/director', label: 'Panel', icon: LayoutDashboard, roles: ['DIRECTOR'] },
  { href: '/dashboard/director/works', label: 'Trabajos de Grado', icon: FileText, roles: ['DIRECTOR'] },
  { href: '/dashboard/director/metrics', label: 'Métricas', icon: BarChart3, roles: ['DIRECTOR'] },

  { href: '/dashboard/registro', label: 'Panel', icon: LayoutDashboard, roles: ['REGISTRO'] },
  { href: '/dashboard/registro/students', label: 'Elegibilidad', icon: UserCheck, roles: ['REGISTRO'] },

  { href: '/dashboard/cobros', label: 'Panel', icon: LayoutDashboard, roles: ['COBROS'] },
  { href: '/dashboard/cobros/payments', label: 'Comprobantes', icon: CreditCard, roles: ['COBROS'] },

  { href: '/dashboard/jurado', label: 'Panel', icon: LayoutDashboard, roles: ['JURADO'] },
  { href: '/dashboard/jurado/works', label: 'Trabajos a Calificar', icon: FileText, roles: ['JURADO'] },

  { href: '/dashboard/admin', label: 'Panel Admin', icon: LayoutDashboard, roles: ['ADMIN'] },
  { href: '/dashboard/admin/users', label: 'Usuarios', icon: Users, roles: ['ADMIN'] },
  { href: '/dashboard/admin/careers', label: 'Carreras', icon: BookOpen, roles: ['ADMIN'] },
  { href: '/dashboard/admin/metrics', label: 'Métricas', icon: BarChart3, roles: ['ADMIN'] },
  { href: '/dashboard/admin/audit', label: 'Auditoría', icon: Settings, roles: ['ADMIN'] },
  { href: '/dashboard/admin/works', label: 'Trabajos', icon: FileText, roles: ['ADMIN'] },
  { href: '/dashboard/admin/payments', label: 'Pagos', icon: CreditCard, roles: ['ADMIN'] },

  { href: '/repository', label: 'Repositorio', icon: Search, roles: ['STUDENT', 'ADVISOR', 'COORDINATOR', 'ADMIN', 'DIRECTOR', 'REGISTRO', 'COBROS', 'JURADO'] },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();

  useNotificationSSE();

  useEffect(() => {
    if (!Cookies.get('accessToken') && !user) {
      router.replace('/login');
    }
  }, [user, router]);

  const role = user?.role as UserRole;
  const navItems = NAV_ITEMS.filter((i) => i.roles.includes(role));

  const { data: unreadData } = useQuery({
    queryKey: ['notifications-unread'],
    queryFn: notificationsApi.getUnread,
    refetchInterval: 60_000,
    enabled: !!user,
  });
  const unreadCount: number = Array.isArray(unreadData) ? unreadData.length : (unreadData?.count ?? 0);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <ToastContainer />
      {/* Overlay mobile */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-20 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={cn(
        'fixed md:static inset-y-0 left-0 z-30 w-64 bg-unphu-800 flex flex-col transition-transform duration-200',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
      )}>
        {/* Logo */}
        <div className="p-5 border-b border-unphu-700 flex items-center gap-3">
          <div className="w-9 h-9 bg-gold-400 rounded-xl flex items-center justify-center">
            <GraduationCap className="w-5 h-5 text-unphu-900" />
          </div>
          <div className="text-white">
            <p className="font-bold text-sm leading-none">UNPHU</p>
            <p className="text-xs text-unphu-300 mt-0.5">Gestión de Tesis</p>
          </div>
          <button className="ml-auto md:hidden text-unphu-300 hover:text-white" onClick={() => setSidebarOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 overflow-y-auto">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-5 py-2.5 text-sm transition-colors group',
                  active
                    ? 'bg-white/10 text-white font-medium'
                    : 'text-unphu-300 hover:text-white hover:bg-white/5',
                )}
              >
                <item.icon className={cn('w-4 h-4', active ? 'text-gold-400' : 'text-unphu-400 group-hover:text-unphu-200')} />
                {item.label}
                {active && <ChevronRight className="w-3 h-3 ml-auto text-gold-400" />}
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div className="p-4 border-t border-unphu-700">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-gold-400 flex items-center justify-center text-unphu-900 font-bold text-sm">
              {getInitials(user?.firstName || 'U', user?.lastName || 'N')}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium truncate">{user?.firstName} {user?.lastName}</p>
              <p className="text-unphu-400 text-xs truncate">{user?.role}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-2 text-unphu-400 hover:text-red-400 text-xs w-full transition-colors">
            <LogOut className="w-3.5 h-3.5" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
          <button
            className="md:hidden text-gray-500 hover:text-gray-900"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex-1" />
          <Link href="/dashboard/notifications" className="relative text-gray-500 hover:text-gray-900">
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Link>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
