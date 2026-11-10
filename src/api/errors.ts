/* The one place where backend error codes become words.
   The backend sends { code: 'AUTH_BAD_CREDENTIALS', detail: '...', fields: { email: [{ code, detail }] } }.
   Behaviour depends on the code only. The server's `detail` text is never read or shown.
   Components compare against `Code.*` and show text from this file, so there are no magic strings in them. */

/** Generic messages by situation. Used when a code has no entry below. */
export const MESSAGES = {
  network: 'Nudge could not be reached. Check your connection and try again.',
  timeout: 'That took too long. Try again.',
  unauthorized: 'Your session has ended. Sign in again.',
  forbidden: 'You do not have access to that.',
  rate_limited: 'Too many attempts, try again later.',
  not_found: 'That could not be found.',
  invalid: 'Check the highlighted fields and try again.',
  server: 'Something went wrong on our side. Try again in a moment.',
} as const

/** Backend codes the screens branch on. */
export const Code = {
  BAD_CREDENTIALS: 'AUTH_BAD_CREDENTIALS',
  EMAIL_UNVERIFIED: 'AUTH_EMAIL_UNVERIFIED',
  INVALID_CODE: 'AUTH_INVALID_CODE',
  CODE_ATTEMPTS_EXCEEDED: 'AUTH_CODE_ATTEMPTS_EXCEEDED',
  INVALID_TOKEN: 'AUTH_INVALID_TOKEN',
  WRONG_CURRENT_PASSWORD: 'AUTH_WRONG_CURRENT_PASSWORD',
  SESSION_INVALID: 'AUTH_SESSION_INVALID',
  ACCESS_TOKEN_INVALID: 'AUTH_ACCESS_TOKEN_INVALID',
  CSRF_FAILED: 'AUTH_CSRF_FAILED',
  RATE_LIMITED: 'COMMON_RATE_LIMITED',
  VALIDATION_FAILED: 'COMMON_VALIDATION_FAILED',
} as const

/** Message for a top-level error code. */
const CODE_MESSAGES: Record<string, string> = {
  [Code.BAD_CREDENTIALS]: 'That email and password do not match.',
  [Code.EMAIL_UNVERIFIED]: 'Verify your email first. Check your inbox for the code.',
  [Code.INVALID_CODE]: 'That code is not valid or has expired.',
  [Code.CODE_ATTEMPTS_EXCEEDED]: 'Too many wrong codes. Send a new code to try again.',
  [Code.INVALID_TOKEN]: 'This link is not valid or has expired. Ask for a new one.',
  [Code.SESSION_INVALID]: MESSAGES.unauthorized,
  [Code.ACCESS_TOKEN_INVALID]: MESSAGES.unauthorized,
  [Code.CSRF_FAILED]: 'Something went wrong. Reload the page and try again.',
  [Code.RATE_LIMITED]: MESSAGES.rate_limited,
  [Code.VALIDATION_FAILED]: MESSAGES.invalid,
  COMMON_FORBIDDEN: MESSAGES.forbidden,
  COMMON_NOT_FOUND: MESSAGES.not_found,
  COMMON_SERVER_ERROR: MESSAGES.server,
  COMMON_SERVICE_UNAVAILABLE: MESSAGES.server,
  COMMON_MALFORMED_JSON: MESSAGES.invalid,
  COMMON_INVALID_CONTENT_TYPE: MESSAGES.invalid,
  COMMON_BODY_TOO_LARGE: MESSAGES.invalid,
}

/** Message for a per-field code (body.fields.<name>[].code). */
const FIELD_MESSAGES: Record<string, string> = {
  VALIDATION_REQUIRED: 'This field is required.',
  VALIDATION_TOO_SHORT: 'That is too short.',
  VALIDATION_TOO_LONG: 'That is too long.',
  VALIDATION_INVALID_TYPE: 'That value is not valid.',
  VALIDATION_UNKNOWN_FIELD: 'That value is not valid.',
  VALIDATION_CONTROL_CHARS: 'Remove special control characters.',
  VALIDATION_MARKUP_NOT_ALLOWED: 'Remove the characters < and >.',
  VALIDATION_NAME_NEEDS_LETTER: 'Include at least one letter.',
  VALIDATION_EMAIL_INVALID: 'Enter a valid email address.',
  VALIDATION_PASSWORD_TOO_SHORT: 'Use at least 8 characters.',
  VALIDATION_PASSWORD_TOO_LONG: 'That password is too long.',
  VALIDATION_PASSWORD_NEEDS_MIXED_CASE: 'Use upper and lower case letters.',
  VALIDATION_PASSWORD_NEEDS_DIGIT: 'Include a number.',
  VALIDATION_PASSWORD_TOO_COMMON: 'That password is too common.',
  VALIDATION_PASSWORD_CONTAINS_EMAIL: 'Do not use part of your email in your password.',
  VALIDATION_PASSWORD_CONTAINS_NAME: 'Do not use your name in your password.',
  VALIDATION_PASSWORD_SAME_AS_CURRENT: 'Choose a password you have not used here.',
  VALIDATION_CHOICE_INVALID: 'Choose one of the options.',
  VALIDATION_COMPANY_NOT_ALLOWED: 'A company name is only for business accounts.',
  VALIDATION_TIMEZONE_INVALID: 'That time zone is not valid.',
  VALIDATION_CODE_FORMAT: 'Enter all 6 digits.',
  [Code.WRONG_CURRENT_PASSWORD]: 'Your current password is not right.',
}
const FIELD_FALLBACK = 'Check this field.'

/** Backend codes look like AREA_SOMETHING. Anything else is ignored, so odd server text can never be used as a key. */
export const CODE_SHAPE = /^[A-Z][A-Z0-9_]{2,63}$/
export const FIELD_SHAPE = /^[a-z_]{1,40}$/

export const isCode = (v: unknown): v is string => typeof v === 'string' && CODE_SHAPE.test(v)

/** Text for a status the server answered without a known code. */
export function statusMessage(status: number): string {
  if (status === 401) return MESSAGES.unauthorized
  if (status === 403) return MESSAGES.forbidden
  if (status === 404) return MESSAGES.not_found
  if (status === 429) return MESSAGES.rate_limited
  if (status === 400 || status === 422) return MESSAGES.invalid
  return MESSAGES.server
}

export const messageFor = (code: string, status: number): string => CODE_MESSAGES[code] ?? statusMessage(status)
export const fieldMessage = (code: string): string => FIELD_MESSAGES[code] ?? FIELD_FALLBACK

/** { email: 'Enter a valid email address.' } from an ApiError. Empty when the error has no field codes. */
export function fieldMessages(e: unknown): Record<string, string> {
  const fc = (e as { fieldCodes?: Record<string, string> } | null)?.fieldCodes
  const out: Record<string, string> = {}
  if (fc && typeof fc === 'object') for (const [k, c] of Object.entries(fc)) out[k] = fieldMessage(c)
  return out
}
