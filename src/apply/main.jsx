import { createRoot } from 'react-dom/client'
import Apply from './Apply.jsx'
import { initMonitor, ErrorBoundary } from '../monitor.jsx'
import './apply.css'

initMonitor('apply')
document.documentElement.dataset.role = 'editor'
document.documentElement.dataset.theme = 'dark'
createRoot(document.getElementById('apply-root')).render(
  <ErrorBoundary>
    <Apply />
  </ErrorBoundary>
)
