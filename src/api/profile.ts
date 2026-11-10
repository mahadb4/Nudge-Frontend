/* Profile and workspace updates. Real mode: PATCH /auth/me/ and PATCH /organizations/current/.
   The caller shows "saved" only after these resolve, and copies the returned user into the store.
   Mock mode (VITE_USE_MOCK_API=true) merges the change locally, like the rest of the demo. */

import type { User } from '../store'
import { getState, setSettings } from '../store'
import { request, isMock, type MeDto } from './client'
import { toUser } from './auth'

export interface ProfilePatch { name?: string; phone?: string | null; timezone?: string; quietStart?: string | null; quietEnd?: string | null }
export interface WorkspacePatch { name?: string; timezone?: string }
export interface StageRow { id: string; name: string; position: number; outcome: 'open' | 'won' | 'lost'; deal_count: number }

const wait = (ms = 250) => new Promise<void>((r) => setTimeout(r, ms))
const here = (): User => { const u = getState().user; if (!u) throw new Error('not signed in'); return u }

export const profile = {
  /** Only the fields in `patch` are sent. Resolves to the user as the server now has them. */
  async update(patch: ProfilePatch): Promise<User> {
    if (!isMock) {
      const body: Record<string, unknown> = {}
      if (patch.name !== undefined) body.name = patch.name
      if (patch.phone !== undefined) body.phone = patch.phone
      if (patch.timezone !== undefined) body.timezone = patch.timezone
      if (patch.quietStart !== undefined) body.quiet_hours_start = patch.quietStart
      if (patch.quietEnd !== undefined) body.quiet_hours_end = patch.quietEnd
      return toUser(await request<MeDto>('/auth/me/', { method: 'PATCH', body }))
    }
    await wait()
    if (patch.timezone) setSettings({ tz: patch.timezone })
    return { ...here(), ...patch }
  },
}

export const workspace = {
  /** Owner and Admin only; the server answers 403 for anyone else. Resolves to the user with the new organization. */
  async update(patch: WorkspacePatch): Promise<User> {
    const u = here()
    if (!isMock) {
      const org = await request<{ id: string; name: string; type: 'individual' | 'business'; timezone: string }>('/organizations/current/', { method: 'PATCH', body: patch })
      return { ...u, organization: { id: org.id, name: org.name, type: org.type, timezone: org.timezone } }
    }
    await wait()
    if (patch.timezone) setSettings({ tz: patch.timezone })
    const o = u.organization ?? { id: 'mock', name: 'Acme Sales', type: u.type, timezone: getState().settings.tz }
    return { ...u, organization: { ...o, ...patch } }
  },

  /** GET /deal-stages/, read only here. Mock mode has no server list. */
  async stages(): Promise<StageRow[]> {
    if (isMock) return []
    return request<StageRow[]>('/deal-stages/')
  },
}
