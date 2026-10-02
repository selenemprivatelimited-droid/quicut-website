import { lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import AdminApp from './AdminApp.jsx'
import { initMonitor, ErrorBoundary } from '../monitor.jsx'

// same 3D backdrop as the website and app, tinted violet for admin (AppScene reads data-role)
const AppScene = lazy(() => import('../app/AppScene.jsx'))
const hasWebGL = (() => {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
})()

initMonitor('admin')
createRoot(document.getElementById('admin-root')).render(
  <ErrorBoundary>
    <div className="app-scene app-scene-fallback" aria-hidden="true" />
    {hasWebGL && (
      <Suspense fallback={null}>
        <AppScene />
      </Suspense>
    )}
    <AdminApp />
  </ErrorBoundary>
)
