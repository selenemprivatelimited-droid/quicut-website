import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { initMonitor, ErrorBoundary } from './monitor.jsx'

initMonitor('site')
createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
)
