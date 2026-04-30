'use client';
import { FormEvent, useState } from 'react';
import toast from 'react-hot-toast';
import { authApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';

const avatars = Array.from({ length: 10 }, (_, index) => `/avatars/avatar-${String(index + 1).padStart(2, '0')}.svg`);

export default function ProfilePage() {
  const { user, setUser } = useAuth();
  const { language, setLanguage, t } = useI18n();
  const [name, setName] = useState(user?.name ?? '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl ?? avatars[0]);
  const [saving, setSaving] = useState(false);

  async function save(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await authApi.updateMe({ name, avatarUrl });
      setUser(data);
      toast.success('Profile updated');
    } catch {
      toast.error('Could not update profile');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-950 dark:text-white">{t('profile')}</h1>
        <p className="mt-1 text-slate-500 dark:text-slate-400">Manage your identity, avatar, and language.</p>
      </div>

      <form onSubmit={save} className="max-w-3xl rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="grid gap-6 md:grid-cols-[180px_1fr]">
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={avatarUrl} alt="" className="h-32 w-32 rounded-2xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950" />
          </div>
          <div className="space-y-5">
            <label>
              <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder="Your name" />
            </label>

            <label>
              <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">{t('language')}</span>
              <select value={language} onChange={(e) => setLanguage(e.target.value as 'en' | 'es')} className="input">
                <option value="en">{t('english')}</option>
                <option value="es">{t('spanish')}</option>
              </select>
            </label>

            <div>
              <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Default avatars</span>
              <div className="grid grid-cols-5 gap-3">
                {avatars.map((avatar) => (
                  <button
                    type="button"
                    key={avatar}
                    onClick={() => setAvatarUrl(avatar)}
                    className={`rounded-xl border p-1 transition ${avatarUrl === avatar ? 'border-brand-500 ring-2 ring-brand-500/30' : 'border-slate-200 dark:border-slate-800'}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={avatar} alt="" className="h-14 w-14 rounded-lg" />
                  </button>
                ))}
              </div>
            </div>

            <button disabled={saving} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-50">
              {saving ? 'Saving...' : 'Save profile'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
