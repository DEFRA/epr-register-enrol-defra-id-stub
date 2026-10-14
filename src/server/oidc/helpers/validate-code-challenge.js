import { generateCodeChallenge } from '#/server/oidc/helpers/oidc-crypto.js'

// /authorize only accepts S256 challenges, so every session has one.
function validateCodeChallenge(session, codeVerifier) {
  if (!codeVerifier) {
    return { valid: false, err: 'code_verifier is required' }
  }

  const challenge = generateCodeChallenge(
    session.codeChallengeMethod,
    codeVerifier
  )
  if (challenge !== session.codeChallenge) {
    return {
      valid: false,
      err: 'code_verifier does not match the code_challenge'
    }
  }

  return { valid: true, err: '' }
}

export { validateCodeChallenge }
