import { validateScope } from '#/server/oidc/helpers/validate-scope.js'
import { oidcConfig } from '#/server/oidc/oidc-config.js'

describe('validateScope function', () => {
  it('should accept the scopes the Operator Journey sends, including its bare client id', () => {
    const scope = `openid offline_access ${oidcConfig.clientId}`
    expect(validateScope(scope)).toEqual([])
  })

  it('should return unsupported scopes', () => {
    expect(validateScope('openid profile address')).toEqual([
      'profile',
      'address'
    ])
  })

  it('should handle empty input', () => {
    expect(validateScope('')).toEqual([])
  })

  it('should handle single valid scope', () => {
    expect(validateScope('openid')).toEqual([])
  })
})
