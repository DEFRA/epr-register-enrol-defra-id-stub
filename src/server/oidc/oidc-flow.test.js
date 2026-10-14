import crypto from 'node:crypto'
import path from 'node:path'
import jsonwebtoken from 'jsonwebtoken'

import { config } from '#/config/config.js'
import { oidcConfig } from '#/server/oidc/oidc-config.js'
import { createServer } from '#/server/server.js'

// Drives the stub exactly as the Operator Journey frontend
// (epr-register-enrol-frontend src/server/auth/controller.js) does:
// discovery, /authorize with PKCE S256 + nonce + serviceId, /token with
// client_secret_post, id_token verification against the JWKS, and logout.

const externalUrl = 'http://localhost:3200'
const internalUrl = 'http://epr-register-enrol-defra-id-stub:3000'
const userEmail = 'newdev.recycling@test.gov.uk'
const serviceId = 'a-service-id'
const operatorScope = `openid offline_access ${oidcConfig.clientId}`

const pkcePair = () => {
  const verifier = crypto.randomBytes(32).toString('base64url')
  const challenge = crypto
    .createHash('sha256')
    .update(verifier)
    .digest('base64url')
  return { verifier, challenge }
}

const authorizeUrl = (overrides = {}) => {
  const params = {
    client_id: oidcConfig.clientId,
    serviceId,
    response_type: 'code',
    redirect_uri: oidcConfig.redirectUri,
    scope: operatorScope,
    state: 'the-state',
    nonce: 'the-nonce',
    code_challenge: 'a-challenge',
    code_challenge_method: 'S256',
    user: userEmail,
    ...overrides
  }
  const query = new URLSearchParams(
    Object.entries(params).filter(([, value]) => value !== undefined)
  )
  return `/authorize?${query}`
}

describe('OIDC flow as the Operator Journey drives it', () => {
  let server

  const authorize = async (overrides) => {
    const first = await server.inject({ url: authorizeUrl(overrides) })
    expect(first.statusCode).toBe(302)
    // The user has one relationship, so the organisation picker auto-selects
    // it and redirects to the client.
    expect(first.headers.location).toMatch(/^\/organisations\?sessionId=/)
    const second = await server.inject({ url: first.headers.location })
    expect(second.statusCode).toBe(302)
    return new URL(second.headers.location)
  }

  const token = (fields) =>
    server.inject({
      method: 'POST',
      url: '/token',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: new URLSearchParams({
        client_id: oidcConfig.clientId,
        client_secret: oidcConfig.clientSecret,
        grant_type: 'authorization_code',
        redirect_uri: oidcConfig.redirectUri,
        scope: operatorScope,
        ...fields
      }).toString()
    })

  const codeFor = async (nonce = 'the-nonce') => {
    const { verifier, challenge } = pkcePair()
    const location = await authorize({ code_challenge: challenge, nonce })
    return { code: location.searchParams.get('code'), verifier }
  }

  beforeAll(async () => {
    config.set(
      'usersFile',
      path.resolve(config.get('root'), 'data/local/users.json')
    )
    config.set('stub.externalUrl', externalUrl)
    config.set('stub.internalUrl', internalUrl)
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
    config.reset('usersFile')
    config.reset('stub.externalUrl')
    config.reset('stub.internalUrl')
  })

  describe('discovery', () => {
    it('serves browser endpoints and the issuer from the external URL, and server endpoints from the internal URL', async () => {
      const { result } = await server.inject({
        url: '/.well-known/openid-configuration'
      })

      expect(result).toEqual({
        issuer: externalUrl,
        authorization_endpoint: `${externalUrl}/authorize`,
        token_endpoint: `${internalUrl}/token`,
        jwks_uri: `${internalUrl}/.well-known/jwks.json`,
        end_session_endpoint: `${externalUrl}/logout`,
        grant_types_supported: ['authorization_code'],
        response_types_supported: ['code'],
        subject_types_supported: ['public'],
        id_token_signing_alg_values_supported: ['RS256'],
        scopes_supported: ['openid', 'offline_access', oidcConfig.clientId],
        token_endpoint_auth_methods_supported: ['client_secret_post'],
        claims_supported: oidcConfig.claimsSupported,
        code_challenge_methods_supported: ['S256']
      })
    })

    it('publishes one RS256 signing key', async () => {
      const { result } = await server.inject({ url: '/.well-known/jwks.json' })

      expect(result.keys).toHaveLength(1)
      expect(result.keys[0]).toMatchObject({
        kty: 'RSA',
        alg: 'RS256',
        use: 'sig'
      })
    })
  })

  describe('authorization code flow', () => {
    it('issues an id_token the Operator Journey accepts, echoing the nonce', async () => {
      const { verifier, challenge } = pkcePair()
      const location = await authorize({ code_challenge: challenge })

      expect(`${location.origin}${location.pathname}`).toBe(
        oidcConfig.redirectUri
      )
      expect(location.searchParams.get('state')).toBe('the-state')

      const response = await token({
        code: location.searchParams.get('code'),
        code_verifier: verifier
      })

      expect(response.statusCode).toBe(200)
      expect(response.headers['cache-control']).toBe('no-store')
      expect(response.result).toEqual({
        token_type: 'Bearer',
        expires_in: oidcConfig.ttl,
        access_token: expect.any(String),
        id_token: expect.any(String)
      })

      const { result: jwks } = await server.inject({
        url: '/.well-known/jwks.json'
      })
      const publicKey = crypto.createPublicKey({
        key: jwks.keys[0],
        format: 'jwk'
      })
      const { header, payload } = jsonwebtoken.verify(
        response.result.id_token,
        publicKey,
        {
          algorithms: ['RS256'],
          issuer: externalUrl,
          audience: oidcConfig.clientId,
          complete: true
        }
      )

      expect(header.kid).toBe(jwks.keys[0].kid)
      expect(payload.nonce).toBe('the-nonce')
      expect(payload.iat).toEqual(expect.any(Number))
      expect(payload.exp).toBe(payload.iat + oidcConfig.ttl)
      expect(payload).toMatchObject({
        email: userEmail,
        firstName: expect.any(String),
        lastName: expect.any(String),
        contactId: expect.any(String),
        sub: expect.any(String),
        serviceId
      })

      // The Operator Journey reads the Defra organisation id from segment 1.
      const [relationshipId, organisationId, organisationName] =
        payload.relationships[0].split(':')
      expect(organisationId).toBe('50001')
      expect(organisationName).toBe('NEWDEV RECYCLING LIMITED')
      expect(payload.currentRelationshipId).toBe(relationshipId)
    })

    it('signs the access token with the same key but without the nonce', async () => {
      const { code, verifier } = await codeFor()
      const { result } = await token({ code, code_verifier: verifier })

      const decoded = jsonwebtoken.decode(result.access_token)
      expect(decoded.nonce).toBeUndefined()
      expect(decoded.aud).toBe(oidcConfig.clientId)
    })

    it('accepts the empty serviceId the Operator Journey sends when DEFRA_ID_SERVICE_ID is unset, and omits it from the id_token', async () => {
      const { verifier, challenge } = pkcePair()
      const location = await authorize({
        code_challenge: challenge,
        serviceId: ''
      })
      const { result } = await token({
        code: location.searchParams.get('code'),
        code_verifier: verifier
      })

      expect(jsonwebtoken.decode(result.id_token).serviceId).toBeUndefined()
    })

    it('renders the login page for a valid request with no signed-in user', async () => {
      const response = await server.inject({
        url: authorizeUrl({ user: undefined })
      })

      expect(response.statusCode).toBe(200)
      expect(response.payload).toContain('DEFRA ID Login')
    })
  })

  describe('/authorize rejects requests from anything but the Operator Journey', () => {
    it.each([
      ['an unknown client_id', { client_id: 'someone-else' }],
      [
        'an unregistered redirect_uri',
        { redirect_uri: 'https://evil.example/auth/operator/callback' }
      ],
      ['an unsupported scope', { scope: `${operatorScope} profile` }],
      ['a scope without openid', { scope: oidcConfig.clientId }],
      ['no code_challenge', { code_challenge: undefined }],
      ['the plain PKCE method', { code_challenge_method: 'plain' }],
      ['an unsupported response_type', { response_type: 'token' }]
    ])('rejects %s before showing a login page', async (_, overrides) => {
      const response = await server.inject({
        url: authorizeUrl({ ...overrides, user: undefined })
      })

      expect(response.statusCode).toBe(400)
    })
  })

  describe('/token', () => {
    it.each([
      ['client secret', { client_secret: 'wrong' }],
      ['client id', { client_id: 'someone-else' }]
    ])('rejects a wrong %s with invalid_client', async (_, fields) => {
      const { code, verifier } = await codeFor()
      const response = await token({ code, code_verifier: verifier, ...fields })

      expect(response.statusCode).toBe(401)
      expect(response.result.error).toBe('invalid_client')
    })

    it.each([
      ['a wrong code_verifier', { code_verifier: 'not-the-verifier' }],
      ['no code_verifier', { code_verifier: '' }],
      [
        'a different redirect_uri',
        { redirect_uri: 'http://localhost:3000/elsewhere' }
      ],
      ['an unknown code', { code: 'not-a-code' }]
    ])('rejects %s with invalid_grant', async (_, fields) => {
      const { code, verifier } = await codeFor()
      const response = await token({ code, code_verifier: verifier, ...fields })

      expect(response.statusCode).toBe(400)
      expect(response.result.error).toBe('invalid_grant')
    })

    it('rejects the refresh_token grant', async () => {
      const response = await token({ grant_type: 'refresh_token' })

      expect(response.statusCode).toBe(400)
      expect(response.result.error).toBe('unsupported_grant_type')
    })

    it('accepts a code only once', async () => {
      const { code, verifier } = await codeFor()

      const first = await token({ code, code_verifier: verifier })
      const second = await token({ code, code_verifier: verifier })

      expect(first.statusCode).toBe(200)
      expect(second.statusCode).toBe(400)
      expect(second.result.error).toBe('invalid_grant')
    })

    it('burns a code after a failed exchange', async () => {
      const { code, verifier } = await codeFor()

      await token({ code, code_verifier: 'not-the-verifier' })
      const retry = await token({ code, code_verifier: verifier })

      expect(retry.result.error).toBe('invalid_grant')
    })
  })

  describe('/logout', () => {
    it("redirects to the Operator Journey's post-logout URI", async () => {
      const query = new URLSearchParams({
        post_logout_redirect_uri: oidcConfig.postLogoutRedirectUri,
        id_token_hint: 'a-token'
      })
      const response = await server.inject({ url: `/logout?${query}` })

      expect(response.statusCode).toBe(302)
      expect(response.headers.location).toBe(oidcConfig.postLogoutRedirectUri)
    })

    it.each([
      ['another URI', 'https://evil.example/'],
      ['the URI with a different query', 'http://localhost:3000/auth/logout']
    ])('rejects %s', async (_, uri) => {
      const query = new URLSearchParams({ post_logout_redirect_uri: uri })
      const response = await server.inject({ url: `/logout?${query}` })

      expect(response.statusCode).toBe(400)
    })

    it('rejects a missing post_logout_redirect_uri', async () => {
      const response = await server.inject({ url: '/logout' })

      expect(response.statusCode).toBe(400)
    })
  })
})
