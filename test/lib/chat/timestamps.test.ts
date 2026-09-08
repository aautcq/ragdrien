import { describe, expect, it } from 'vitest'
import { formatMessageTime, syncMessageTimestamps, withRefreshedTimestamp } from '@/lib/chat/timestamps'

describe('syncMessageTimestamps', () => {
  it('records the given time for message ids not already tracked', () => {
    const result = syncMessageTimestamps(new Map(), ['a', 'b'], 1000)

    expect(result).toEqual(new Map([['a', 1000], ['b', 1000]]))
  })

  it('leaves already-tracked ids untouched', () => {
    const existing = new Map([['a', 1000]])

    const result = syncMessageTimestamps(existing, ['a', 'b'], 2000)

    expect(result).toEqual(new Map([['a', 1000], ['b', 2000]]))
  })

  it('returns the same map instance when nothing changed', () => {
    const existing = new Map([['a', 1000]])

    const result = syncMessageTimestamps(existing, ['a'], 2000)

    expect(result).toBe(existing)
  })

  it('drops ids no longer present in messageIds, e.g. after a truncating edit or a regenerated message', () => {
    const existing = new Map([['a', 1000], ['b', 2000]])

    const result = syncMessageTimestamps(existing, ['a', 'c'], 3000)

    expect(result).toEqual(new Map([['a', 1000], ['c', 3000]]))
  })
})

describe('withRefreshedTimestamp', () => {
  it('overwrites the timestamp for the given message id', () => {
    const existing = new Map([['a', 1000], ['b', 2000]])

    const result = withRefreshedTimestamp(existing, 'a', 3000)

    expect(result).toEqual(new Map([['a', 3000], ['b', 2000]]))
  })

  it('does not mutate the map it was given', () => {
    const existing = new Map([['a', 1000]])

    withRefreshedTimestamp(existing, 'a', 3000)

    expect(existing).toEqual(new Map([['a', 1000]]))
  })
})

describe('formatMessageTime', () => {
  it('formats an epoch time as an hour:minute time-of-day string, with no date component', () => {
    const epochMs = Date.UTC(2024, 0, 1, 14, 32)

    expect(formatMessageTime(epochMs)).toMatch(/^\d{1,2}:\d{2}(\s?[AP]M)?$/)
  })
})
