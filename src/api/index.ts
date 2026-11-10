import { auth } from './auth'
import { profile, workspace } from './profile'

/** One entry point for every backend call. Add new resources here, never call fetch from a component. */
export const api = { auth, profile, workspace }
export { ApiError, apiMessage, isMock, setApiHandlers, setAccessToken } from './client'
export { Code, fieldMessages } from './errors'
export { browserTimeZone } from './auth'
