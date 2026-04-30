'use client';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

type Language = 'en' | 'es';

const dict = {
  en: {
    active: 'active',
    activeVersion: 'Active version',
    authenticated: 'authenticated',
    autoDeploy: 'auto deploy',
    container: 'Container',
    cpu: 'CPU',
    deploy: 'Deploy',
    deploymentCount: 'Deployments',
    deployments: 'Deployments',
    english: 'English',
    git: 'Git',
    idle: 'idle',
    language: 'Language',
    liveMetrics: 'Live metrics every 10s',
    mbLimit: 'MB limit',
    memory: 'Memory',
    noActiveDeployment: 'No active deployment',
    noDeployments: 'No deployments yet. Trigger a build to get started.',
    observability: 'Observability',
    port: 'port',
    profile: 'Profile',
    project: 'Project',
    projects: 'Projects',
    ready: 'ready',
    rollback: 'Rollback',
    rollbackConfirm: 'Roll back to the previous deployment?',
    rollbackError: 'Failed to rollback',
    rollbackSuccess: 'Rollback initiated',
    serviceStatus: 'Service status',
    signOut: 'Sign out',
    spanish: 'Spanish',
    statusActive: 'Active',
    statusBuilding: 'Building',
    statusCancelled: 'Cancelled',
    statusDeploying: 'Deploying',
    statusFailed: 'Failed',
    statusIdle: 'Idle',
    statusPending: 'Pending',
    statusRunning: 'Running',
    statusStopped: 'Stopped',
    statusSuccess: 'Success',
    system: 'System',
    terminal: 'Terminal',
    triggerBuildError: 'Failed to trigger build',
    triggerBuildSuccess: 'Build triggered',
    waiting: 'waiting',
    waitingFirstDeployment: 'Waiting for first deployment',
  },
  es: {
    active: 'activo',
    activeVersion: 'Version activa',
    authenticated: 'autenticado',
    autoDeploy: 'auto despliegue',
    container: 'Contenedor',
    cpu: 'CPU',
    deploy: 'Desplegar',
    deploymentCount: 'Despliegues',
    deployments: 'Despliegues',
    english: 'Ingles',
    git: 'Git',
    idle: 'inactivo',
    language: 'Idioma',
    liveMetrics: 'Metricas en vivo cada 10s',
    mbLimit: 'MB limite',
    memory: 'Memoria',
    noActiveDeployment: 'Sin despliegue activo',
    noDeployments: 'Sin despliegues todavia. Ejecuta un build para empezar.',
    observability: 'Observabilidad',
    port: 'puerto',
    profile: 'Perfil',
    project: 'Proyecto',
    projects: 'Proyectos',
    ready: 'listo',
    rollback: 'Revertir',
    rollbackConfirm: 'Revertir al despliegue anterior?',
    rollbackError: 'No se pudo revertir',
    rollbackSuccess: 'Rollback iniciado',
    serviceStatus: 'Estado del servicio',
    signOut: 'Salir',
    spanish: 'Espanol',
    statusActive: 'Activo',
    statusBuilding: 'Construyendo',
    statusCancelled: 'Cancelado',
    statusDeploying: 'Desplegando',
    statusFailed: 'Fallido',
    statusIdle: 'Inactivo',
    statusPending: 'Pendiente',
    statusRunning: 'Ejecutando',
    statusStopped: 'Detenido',
    statusSuccess: 'Exitoso',
    system: 'Sistema',
    terminal: 'Terminal',
    triggerBuildError: 'No se pudo iniciar el build',
    triggerBuildSuccess: 'Build iniciado',
    waiting: 'en espera',
    waitingFirstDeployment: 'Esperando el primer despliegue',
  },
} as const;

export type TranslationKey = keyof typeof dict.en;

const I18nContext = createContext<{
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: TranslationKey) => string;
} | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');

  useEffect(() => {
    const stored = localStorage.getItem('paas_language') as Language | null;
    if (stored === 'es' || stored === 'en') setLanguageState(stored);
  }, []);

  function setLanguage(next: Language) {
    setLanguageState(next);
    localStorage.setItem('paas_language', next);
  }

  const value = useMemo(() => ({
    language,
    setLanguage,
    t: (key: TranslationKey) => dict[language][key],
  }), [language]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useI18n must be used inside I18nProvider');
  return context;
}
