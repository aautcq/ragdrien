import { describe, expect, it } from 'vitest'
import { getVisitorIdFromRequest } from '@/lib/visitor'

function request(cookieHeader?: string): Request {
  return new Request('http://localhost/', cookieHeader ? { headers: { Cookie: cookieHeader } } : {})
}

describe('getVisitorIdFromRequest', () => {
  it('returns the visitor_id cookie\'s value', () => {
    expect(getVisitorIdFromRequest(request('visitor_id=abc-123'))).toBe('abc-123')
  })

  it('finds visitor_id among other cookies, in any position', () => {
    expect(getVisitorIdFromRequest(request('theme=dark; visitor_id=abc-123; lang=en'))).toBe('abc-123')
  })

  it('decodes a URL-encoded cookie value', () => {
    expect(getVisitorIdFromRequest(request('visitor_id=abc%20123'))).toBe('abc 123')
  })

  it('throws when the cookie header is absent', () => {
    expect(() => getVisitorIdFromRequest(request())).toThrow(/visitor_id/)
  })

  it('throws when visitor_id is missing from a present cookie header', () => {
    expect(() => getVisitorIdFromRequest(request('theme=dark'))).toThrow(/visitor_id/)
  })
})
