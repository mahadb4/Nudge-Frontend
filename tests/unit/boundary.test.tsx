// @vitest-environment jsdom
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ErrorBoundary } from '../../src/components/guards'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function Boom(): never { throw new Error('secret@acme.com owes $686,000 — Traceback at Pipeline.tsx:42') }

describe('error boundary', () => {
  afterEach(() => { document.body.innerHTML = '' })
  it('shows a safe message and never the error, stack or data', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const host = document.createElement('div'); document.body.appendChild(host)
    await act(async () => { createRoot(host).render(<ErrorBoundary><Boom /></ErrorBoundary>) })
    expect(host.textContent).toContain('Something went wrong')
    for (const leak of ['secret@acme.com', '686,000', 'Traceback', 'Pipeline.tsx', 'Error:']) expect(host.textContent).not.toContain(leak)
    expect(host.querySelector('[role=alert]')).not.toBeNull()
  })
  it('renders children when nothing is wrong', async () => {
    const host = document.createElement('div'); document.body.appendChild(host)
    await act(async () => { createRoot(host).render(<ErrorBoundary><p>fine</p></ErrorBoundary>) })
    expect(host.textContent).toBe('fine')
  })
})
