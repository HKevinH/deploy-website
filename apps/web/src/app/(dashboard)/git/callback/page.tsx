'use client';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Github, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { authApi } from '@/lib/api';

export default function GitCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState('Completing GitHub connection...');

  useEffect(() => {
    const code = searchParams.get('code');
    const error = searchParams.get('error_description') ?? searchParams.get('error');

    async function complete() {
      if (error) {
        toast.error(error);
        router.replace('/git');
        return;
      }

      if (!code) {
        toast.error('GitHub did not return an authorization code');
        router.replace('/git');
        return;
      }

      try {
        await authApi.completeGithubOAuth(code);
        setMessage('GitHub connected');
        toast.success('GitHub connected');
        router.replace('/git');
      } catch (err: any) {
        toast.error(err?.response?.data?.message ?? 'Could not complete GitHub connection');
        router.replace('/git');
      }
    }

    complete();
  }, [router, searchParams]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-8">
      <div className="rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white">
          <Github className="h-6 w-6" />
        </div>
        <div className="flex items-center justify-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <Loader2 className="h-4 w-4 animate-spin" />
          {message}
        </div>
      </div>
    </div>
  );
}
