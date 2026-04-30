'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { FolderOpen, GitBranch, LogOut, Layers } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { clsx } from 'clsx';
import ThemeToggle from './ThemeToggle';

const nav = [
  { href: '/projects', icon: FolderOpen, label: 'Projects' },
  { href: '/git', icon: GitBranch, label: 'Git' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  function handleLogout() {
    logout();
    router.push('/login');
  }

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      {/* Logo */}
      <div className="border-b border-slate-200 p-5 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 shadow-sm shadow-brand-600/20">
            <Layers className="h-4 w-4 text-white" />
          </div>
          <div>
            <span className="block text-base font-bold text-slate-950 dark:text-white">PaaS</span>
            <span className="block text-xs text-slate-500 dark:text-slate-400">deploy console</span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-4">
        {nav.map(({ href, icon: Icon, label }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
                active
                  ? 'border border-brand-500/30 bg-brand-50 text-brand-700 dark:bg-brand-600/20 dark:text-brand-300'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white',
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="border-t border-slate-200 p-4 dark:border-slate-800">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="min-w-0 px-1">
            <p className="truncate text-xs font-medium text-slate-700 dark:text-slate-300">{user?.email}</p>
            <p className="text-xs text-slate-400 dark:text-slate-500">authenticated</p>
          </div>
          <ThemeToggle />
        </div>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-500 transition-all hover:bg-rose-50 hover:text-rose-600 dark:text-slate-400 dark:hover:bg-rose-950/30 dark:hover:text-rose-300"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
