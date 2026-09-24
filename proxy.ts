import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { VISITOR_COOKIE_MAX_AGE_SECONDS, VISITOR_COOKIE_NAME } from '@/lib/visitor'

/**
 * Mints an opaque Visitor id on a browser's first request, so every Chat
 * can be scoped to the browser that created it — see CONTEXT.md's Visitor
 * term. Runs ahead of every page and API route (see `config.matcher`
 * below), forwarding the freshly-minted cookie onto the request itself
 * (not just the response) so the very same request that mints it already
 * sees it — otherwise the first page load's Server Components/Route
 * Handlers would still find no cookie, since a Set-Cookie response header
 * only reaches the browser, not this request's own downstream handlers.
 */
export function proxy(request: NextRequest) {
  const existing = request.cookies.get(VISITOR_COOKIE_NAME)?.value
  if (existing) {
    return NextResponse.next()
  }

  const visitorId = crypto.randomUUID()

  const requestHeaders = new Headers(request.headers)
  const existingCookieHeader = requestHeaders.get('cookie')
  requestHeaders.set(
    'cookie',
    existingCookieHeader ? `${existingCookieHeader}; ${VISITOR_COOKIE_NAME}=${visitorId}` : `${VISITOR_COOKIE_NAME}=${visitorId}`
  )

  const response = NextResponse.next({ request: { headers: requestHeaders } })
  response.cookies.set(VISITOR_COOKIE_NAME, visitorId, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: VISITOR_COOKIE_MAX_AGE_SECONDS,
    path: '/'
  })
  return response
}

export const config = {
  matcher: '/((?!_next/static|_next/image|favicon.ico).*)'
}
