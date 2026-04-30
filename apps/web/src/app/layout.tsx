import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from 'react-hot-toast';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'PaaS Platform',
  description: 'Self-hosted deployment platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const themeScript = `
    (() => {
      const stored = localStorage.getItem('paas_theme');
      const dark = stored ? stored === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.classList.toggle('dark', dark);
    })();
  `;

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} bg-slate-50 text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-100`}>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: 'var(--toast-bg)',
              color: 'var(--toast-text)',
              border: '1px solid var(--toast-border)',
            },
          }}
        />
      </body>
    </html>
  );
}
