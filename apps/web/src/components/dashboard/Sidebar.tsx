'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { FolderOpen, GitBranch, Layers, LogOut, Server, UserCircle } from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import ThemeToggle from './ThemeToggle';

const nav = [
  { href: '/projects', icon: FolderOpen, labelKey: 'projects' },
  { href: '/git', icon: GitBranch, labelKey: 'git' },
  { href: '/system', icon: Server, labelKey: 'system' },
  { href: '/profile', icon: UserCircle, labelKey: 'profile' },
] as const;

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { language, setLanguage, t } = useI18n();

  function handleLogout() {
    logout();
    router.push('/login');
  }

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
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

      <nav className="flex-1 space-y-1 p-4">
        {nav.map(({ href, icon: Icon, labelKey }) => {
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
              <Icon className="h-4 w-4" />
              {t(labelKey)}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-200 p-4 dark:border-slate-800">
        <div className="mb-3 flex items-center gap-2">
          {user?.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatarUrl} alt="" className="h-9 w-9 rounded-full" />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-700 dark:bg-brand-950/40 dark:text-brand-100">
              {(user?.name ?? user?.email ?? 'U').slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-slate-700 dark:text-slate-300">{user?.name ?? user?.email}</p>
            <p className="text-xs text-slate-400 dark:text-slate-500">{t('authenticated')}</p>
          </div>
          <ThemeToggle />
        </div>
        <select
          value={language}
          onChange={(event) => setLanguage(event.target.value as 'en' | 'es')}
          className="mb-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300"
        >
          <option value="en">{t('english')}</option>
          <option value="es">{t('spanish')}</option>
        </select>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-500 transition-all hover:bg-rose-50 hover:text-rose-600 dark:text-slate-400 dark:hover:bg-rose-950/30 dark:hover:text-rose-300"
        >
          <LogOut className="h-4 w-4" />
          {t('signOut')}
        </button>
      </div>
    </aside>
  );
}
