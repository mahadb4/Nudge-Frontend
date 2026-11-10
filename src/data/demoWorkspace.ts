import type { User } from '../store'

/* DEMO ONLY. REMOVE BEFORE PRODUCTION.
   Screens that have no backend yet show empty lists to real users. The one exception is the seeded demo
   organization (manage.py seed_demo), which keeps the sample data so the unfinished screens can be shown in a
   demonstration. Delete this file and its two callers (hydrateWorkspace in store.ts, the notice in Shell.tsx)
   once every screen is wired. */
export const DEMO_WORKSPACE_NAME = 'Nudge Demo Workspace'

export const isDemoWorkspace = (user: User | null | undefined): boolean => user?.organization?.name === DEMO_WORKSPACE_NAME
