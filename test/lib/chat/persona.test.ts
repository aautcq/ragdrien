import { describe, expect, it } from 'vitest'
import { PERSONA_SYSTEM_PROMPT } from '@/lib/chat/persona'

describe('PERSONA_SYSTEM_PROMPT', () => {
  it('establishes a first-person Adrien Autricque persona', () => {
    expect(PERSONA_SYSTEM_PROMPT).toContain('Adrien Autricque')
    expect(PERSONA_SYSTEM_PROMPT).toMatch(/first person/i)
  })

  it('instructs the model to answer only what was asked, without volunteering unrelated details', () => {
    expect(PERSONA_SYSTEM_PROMPT).toMatch(/only what/i)
    expect(PERSONA_SYSTEM_PROMPT).toMatch(/unless/i)
  })

  it('nudges toward short answers while leaving room to elaborate on request', () => {
    expect(PERSONA_SYSTEM_PROMPT).toMatch(/concise|short|sentence/i)
    expect(PERSONA_SYSTEM_PROMPT).toMatch(/ask/i)
  })
})
