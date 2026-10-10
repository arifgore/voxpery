import { describe, expect, it } from 'vitest'
import { parseInviteLinkCode } from './inviteLinks'

describe('invite links', () => {
  const origin = window.location.origin

  it('recognizes invite links of this instance', () => {
    expect(parseInviteLinkCode(`${origin}/invite/AbC23xyz9k`)).toBe('AbC23xyz9k')
    expect(parseInviteLinkCode(`${origin}/invite/voxpery/`)).toBe('voxpery')
    expect(parseInviteLinkCode(`${origin}/invite/core-guild?ref=chat#top`)).toBe('core-guild')
  })

  it('leaves other hosts, paths and malformed codes to the external link flow', () => {
    expect(parseInviteLinkCode('https://evil.example/invite/AbC23xyz9k')).toBeNull()
    expect(parseInviteLinkCode(`${origin}/invites/AbC23xyz9k`)).toBeNull()
    expect(parseInviteLinkCode(`${origin}/invite/AbC23xyz9k/extra`)).toBeNull()
    expect(parseInviteLinkCode(`${origin}/invite/bad.code`)).toBeNull()
    expect(parseInviteLinkCode(`${origin}/invite/${'a'.repeat(33)}`)).toBeNull()
    expect(parseInviteLinkCode(`${origin.replace('://', '://user:pass@')}/invite/AbC23xyz9k`)).toBeNull()
    expect(parseInviteLinkCode('not a url')).toBeNull()
  })
})
