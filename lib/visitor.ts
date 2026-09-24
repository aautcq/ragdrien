/**
 * A Visitor is the anonymous, cookie-identified owner of a browser's Chats —
 * see CONTEXT.md's Visitor term. No login: proxy.ts mints an opaque random
 * id into this cookie on a browser's first request, ahead of every page and
 * API route, so both always see it already set.
 */
export const VISITOR_COOKIE_NAME = 'visitor_id'

export const VISITOR_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365 // 1 year

/**
 * Parses the Visitor id straight off a Route Handler's incoming Request —
 * used instead of next/headers' `cookies()` so route handlers stay plain
 * Web API functions, testable with a bare `Request` (see e.g.
 * test/app/api/chats/route.test.ts) without a Next.js request-scope. Throws
 * if the cookie is missing: proxy.ts guarantees it's set on every request
 * that reaches a route, so a miss here means proxy.ts didn't run — a bug,
 * not a condition callers should handle.
 */
export function getVisitorIdFromRequest(request: Request): string {
  const header = request.headers.get('cookie') ?? ''
  const cookie = header
    .split(';')
    .map(part => part.trim())
    .find(part => part.startsWith(`${VISITOR_COOKIE_NAME}=`))

  const value = cookie?.slice(VISITOR_COOKIE_NAME.length + 1)
  if (!value) {
    throw new Error(`Missing "${VISITOR_COOKIE_NAME}" cookie — proxy.ts should set it on every request`)
  }
  return decodeURIComponent(value)
}
