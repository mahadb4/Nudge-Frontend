import { auth } from './auth'

/** One entry point for every backend call. Add new resources here, never call fetch from a component. */
export const api = { auth }
export { ApiError, apiMessage, isMock, setApiHandlers, setAccessToken } from './client'
export { Code, fieldMessages } from './errors'
export { browserTimeZone } from './auth'
