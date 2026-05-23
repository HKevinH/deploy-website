'use client';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

type Language = 'en' | 'es';

const dict = {
  en: {
    active: 'active',
    activeVersion: 'Active version',
    authenticated: 'authenticated',
    autoDeploy: 'auto deploy',
    autoScrollOff: 'auto-scroll off',
    autoScrollOn: 'auto-scroll on',
    buildHistory: 'Build history',
    buildLogs: 'Build logs',
    container: 'Container',
    containerActionError: 'Container action failed',
    containerRestarted: 'Container restarted',
    containerStarted: 'Container started',
    containerStopped: 'Container stopped',
    cpu: 'CPU',
    deploy: 'Deploy',
    deploymentStarted: 'Deployment queued from the latest image',
    deploymentCount: 'Deployments',
    deployments: 'Deployments',
    english: 'English',
    git: 'Git',
    idle: 'idle',
    invalidPort: 'Enter a valid port from 1 to 65535',
    language: 'Language',
    liveMetrics: 'Live metrics every 10s',
    loadingBuilds: 'Loading builds...',
    loadingLogs: 'Loading logs...',
    mbLimit: 'MB limit',
    memory: 'Memory',
    downloadLogs: 'Download logs',
    noActiveDeployment: 'No active deployment',
    noBuilds: 'No builds yet. Trigger a build to see logs.',
    noDeployments: 'No deployments yet. Trigger a build to get started.',
    observability: 'Observability',
    port: 'port',
    portUpdated: 'Port updated. Redeploy to apply it to the container.',
    portUpdateError: 'Failed to update port',
    profile: 'Profile',
    project: 'Project',
    projects: 'Projects',
    ready: 'ready',
    replicas: 'Replicas',
    requests: 'Requests',
    rollback: 'Rollback',
    rollbackConfirm: 'Roll back to the previous deployment?',
    rollbackError: 'Failed to rollback',
    rollbackSuccess: 'Rollback initiated',
    restart: 'Restart',
    savePort: 'Save port',
    saveRuntime: 'Save runtime',
    serviceStatus: 'Service status',
    signOut: 'Sign out',
    spanish: 'Spanish',
    start: 'Start',
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
    stop: 'Stop',
    system: 'System',
    terminal: 'Terminal',
    triggerBuildError: 'Failed to trigger build',
    triggerBuildSuccess: 'Build triggered',
    waiting: 'waiting',
    waitingForBuildLogs: 'Waiting for build logs...',
    waitingFirstDeployment: 'Waiting for first deployment',
  },
  es: {
    active: 'activo',
    activeVersion: 'Version activa',
    authenticated: 'autenticado',
    autoDeploy: 'auto despliegue',
    autoScrollOff: 'auto-scroll apagado',
    autoScrollOn: 'auto-scroll encendido',
    buildHistory: 'Historial de builds',
    buildLogs: 'Logs del build',
    container: 'Contenedor',
    containerActionError: 'No se pudo ejecutar la accion del contenedor',
    containerRestarted: 'Contenedor reiniciado',
    containerStarted: 'Contenedor iniciado',
    containerStopped: 'Contenedor detenido',
    cpu: 'CPU',
    deploy: 'Desplegar',
    deploymentStarted: 'Despliegue en cola desde la ultima imagen',
    deploymentCount: 'Despliegues',
    deployments: 'Despliegues',
    english: 'Ingles',
    git: 'Git',
    idle: 'inactivo',
    invalidPort: 'Ingresa un puerto valido entre 1 y 65535',
    language: 'Idioma',
    liveMetrics: 'Metricas en vivo cada 10s',
    loadingBuilds: 'Cargando builds...',
    loadingLogs: 'Cargando logs...',
    mbLimit: 'MB limite',
    memory: 'Memoria',
    downloadLogs: 'Descargar logs',
    noActiveDeployment: 'Sin despliegue activo',
    noBuilds: 'Sin builds todavia. Ejecuta un build para ver logs.',
    noDeployments: 'Sin despliegues todavia. Ejecuta un build para empezar.',
    observability: 'Observabilidad',
    port: 'puerto',
    portUpdated: 'Puerto actualizado. Redespliega para aplicarlo al contenedor.',
    portUpdateError: 'No se pudo actualizar el puerto',
    profile: 'Perfil',
    project: 'Proyecto',
    projects: 'Proyectos',
    ready: 'listo',
    replicas: 'Replicas',
    requests: 'Peticiones',
    rollback: 'Revertir',
    rollbackConfirm: 'Revertir al despliegue anterior?',
    rollbackError: 'No se pudo revertir',
    rollbackSuccess: 'Rollback iniciado',
    restart: 'Reiniciar',
    savePort: 'Guardar puerto',
    saveRuntime: 'Guardar runtime',
    serviceStatus: 'Estado del servicio',
    signOut: 'Salir',
    spanish: 'Espanol',
    start: 'Iniciar',
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
    stop: 'Detener',
    system: 'Sistema',
    terminal: 'Terminal',
    triggerBuildError: 'No se pudo iniciar el build',
    triggerBuildSuccess: 'Build iniciado',
    waiting: 'en espera',
    waitingForBuildLogs: 'Esperando logs del build...',
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
