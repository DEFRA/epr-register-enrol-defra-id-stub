import {
  generateCodeChallenge,
  sha256
} from '#/server/oidc/helpers/oidc-crypto.js'

describe('sha256', () => {
  it('should produce a valid url-safe base 64 hash in', () => {
    const hash = sha256('foobarbaz')
    expect(hash).toBe('l981iLWj8kurw4UbNy8Lpxqdzd7UOxS50Glhv8FwfZ0')

    const hash2 = sha256('foobar')
    expect(hash2).toBe('w6uP8Tcg6K2QR905Rms8iXTlksL6OD1KOWBxTK7wxPI')
  })
})

describe('generateCodeChallenge', () => {
  it('should return null in plain mode: only S256 is supported', () => {
    expect(generateCodeChallenge('plain', 'foobarbaz')).toBeNull()
  })

  it('should return the codeVerifier as a sha256 encoded codeVerifier in S256 mode', () => {
    const result = generateCodeChallenge('S256', 'foobarbaz')
    expect(result).toBe('l981iLWj8kurw4UbNy8Lpxqdzd7UOxS50Glhv8FwfZ0')
  })

  it('should return null when the mode is invalid', () => {
    const result = generateCodeChallenge('foo', 'foobarbaz')
    expect(result).toBeNull()
  })
})
