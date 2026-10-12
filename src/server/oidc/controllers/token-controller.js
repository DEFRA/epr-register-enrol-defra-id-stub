import { generateTokens } from '#/server/oidc/helpers/oidc-crypto.js'
import { getSession, setSession } from '#/server/oidc/helpers/session-store.js'
import { validateCodeChallenge } from '#/server/oidc/helpers/validate-code-challenge.js'
import { oidcConfig } from '#/server/oidc/oidc-config.js'

// RFC 6749 section 5.2 error response.
const tokenError = (h, error, description, statusCode = 400) =>
  h
    .response({ error, error_description: description })
    .header('Cache-Control', 'no-store')
    .code(statusCode)

// Codes are single use: the first exchange marks the session granted, even if
// it then fails, so a code can never be retried.
async function redeemCode(code) {
  const session = await getSession(code)
  if (!session || session.granted) {
    return null
  }
  await setSession(code, { ...session, granted: true })
  return session
}

const tokenController = {
  handler: async (request, h) => {
    const logger = request.logger
    const {
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: grantType,
      code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier
    } = request.payload ?? {}

    if (
      clientId !== oidcConfig.clientId ||
      clientSecret !== oidcConfig.clientSecret
    ) {
      logger.warn('token: client authentication failed')
      return tokenError(
        h,
        'invalid_client',
        'Client authentication failed',
        401
      )
    }

    if (grantType !== 'authorization_code') {
      return tokenError(
        h,
        'unsupported_grant_type',
        'Only authorization_code is supported'
      )
    }

    const session = await redeemCode(code)
    if (!session) {
      return tokenError(h, 'invalid_grant', 'Unknown or already used code')
    }

    if (session.clientId !== clientId || session.redirectUri !== redirectUri) {
      return tokenError(
        h,
        'invalid_grant',
        'client_id or redirect_uri does not match the authorization request'
      )
    }

    const { valid, err } = validateCodeChallenge(session, codeVerifier)
    if (!valid) {
      logger.warn({ err }, 'token: PKCE verification failed')
      return tokenError(h, 'invalid_grant', err)
    }

    const tokens = await generateTokens(
      request.keys,
      session,
      request.registrationsStore
    )
    if (!tokens) {
      return tokenError(h, 'invalid_grant', 'The user no longer exists')
    }

    return h
      .response({
        token_type: 'Bearer',
        expires_in: oidcConfig.ttl,
        access_token: tokens.accessToken,
        id_token: tokens.idToken
      })
      .header('Cache-Control', 'no-store')
      .code(200)
  }
}

export { tokenController }
