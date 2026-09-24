import { cookies } from 'next/headers'
import { VISITOR_COOKIE_NAME } from '@/lib/visitor'

/**
 * The current request's Visitor id, for Server Components (which don't
 * receive a Request to read a Cookie header from — see
 * lib/visitor.ts's getVisitorIdFromRequest for Route Handlers). Throws if
 * missing, since proxy.ts guarantees the cookie on every request.
 */
export async function getVisitorId(): Promise<string> {
  const store = await cookies()
  const value = store.get(VISITOR_COOKIE_NAME)?.value
  if (!value) {
    throw new Error(`Missing "${VISITOR_COOKIE_NAME}" cookie — proxy.ts should set it on every request`)
  }
  return value
}
