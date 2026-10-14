import * as crypto from 'crypto'
import { config } from '#/config/config.js'

let sessionCache

// Must be called once during server startup (see oidc plugin register) before
// any of the functions below are used. A session is created at /authorize and
// its id is the authorization code. It lives in the server's in-memory cache,
// so the stub must run as a single instance.
function initSessionStore(server, expiresIn) {
  sessionCache = server.cache({
    cache: config.get('session.cache.name'),
    segment: 'oidc-sessions',
    expiresIn
  })
}

async function getSession(sessionId) {
  if (!sessionId) {
    return undefined
  }
  return (await sessionCache.get(sessionId)) ?? undefined
}

async function setSession(sessionId, session) {
  await sessionCache.set(sessionId, session)
  return session
}

async function newSession({
  clientId,
  scope,
  nonce,
  serviceId,
  user,
  codeChallenge,
  codeChallengeMethod,
  forceReselection,
  redirectUri,
  state
}) {
  const id = crypto.randomUUID()

  const session = {
    sessionId: id,
    clientId,
    scopes: scope.split(' '),
    nonce,
    serviceId,
    user,
    granted: false,
    codeChallenge,
    codeChallengeMethod,
    forceReselection,
    redirectUri,
    state
  }

  await setSession(id, session)

  return session
}

export { getSession, setSession, newSession, initSessionStore }
