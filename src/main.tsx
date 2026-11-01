import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import '@fontsource-variable/geist'
import '@fontsource-variable/geist-mono'
import './styles/app.css'
import App from './App'
import { ErrorBoundary } from './components/guards'
import { applyTheme, getState } from './store'

applyTheme(getState().settings.theme)
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (getState().settings.theme === 'system') applyTheme('system')
})

const root = document.getElementById('root')
if (!root) throw new Error('Missing #root')
createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)
