import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary'
import { initPostHog } from './analytics/posthog'

// Initialise PostHog before the first render so the earliest stage
// transitions (`app_view`, `upload_started`) are captured. No-ops when
// VITE_POSTHOG_KEY is unset.
initPostHog()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
