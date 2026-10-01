import { createRoot } from 'react-dom/client'
import AdminApp from './AdminApp.jsx'
import { initMonitor, ErrorBoundary } from '../monitor.jsx'

initMonitor('admin')
createRoot(document.getElementById('admin-root')).render(
  <ErrorBoundary>
    <AdminApp />
  </ErrorBoundary>
)
