import * as crypto from 'crypto'
import { generateDefraIdToken } from '#/server/oidc/helpers/generate-defraid-token.js'
import jsonwebtoken from 'jsonwebtoken'
import { jwk2pem } from 'pem-jwk'
import { createLogger } from '#/server/common/helpers/logging/logger.js'

const logger = createLogger()

function loadKeyPair(pub, priv) {
  const privatePem = crypto.createPrivateKey({
    key: priv,
    format: 'pem',
    encoding: 'utf8'
  })

  const publicPem = crypto.createPublicKey({
    key: pub,
    format: 'pem',
    encoding: 'utf8'
  })

  const pem = {
    publicKey: publicPem,
    privateKey: privatePem
  }

  const jwk = {
    publicKey: pem.publicKey.export({ format: 'jwk' }),
    privatePem: pem.privateKey.export({ format: 'jwk' })
  }

  const keyId = sha256(publicPem.export({ type: 'spki', format: 'der' }))

  return {
    jwk,
    keyId,
    pem
  }
}

function generateRandomKeypair() {
  const jwk = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048, // 2048 bits is recommended for RSA keys
    publicKeyEncoding: {
      type: 'spki',
      format: 'jwk'
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'jwk'
    }
  })

  const pem = {
    publicKey: jwk2pem(jwk.publicKey),
    privateKey: jwk2pem(jwk.privateKey)
  }
  const keyId = keyID(pem.publicKey)
  return {
    jwk,
    keyId,
    pem
  }
}

function JWKS(keys) {
  const jwks = {
    kty: 'RSA',
    n: Buffer.from(keys.jwk.publicKey.n, 'base64').toString('base64url'),
    e: Buffer.from(keys.jwk.publicKey.e, 'base64').toString('base64url'),
    alg: 'RS256',
    use: 'sig',
    kid: keys.keyId
  }

  return {
    keys: [jwks]
  }
}

function sign(keys, claims) {
  return jsonwebtoken.sign(claims, keys.pem.privateKey, {
    algorithm: 'RS256',
    keyid: keys.keyId
  })
}

// Returns null when the session's user no longer has a registration.
async function generateTokens(keys, session, store) {
  const claims = await generateDefraIdToken(session, store)
  if (!claims) {
    logger.warn('No claims found for session user')
    return null
  }
  return {
    accessToken: sign(keys, claims),
    idToken: sign(keys, { ...claims, nonce: session.nonce })
  }
}

function generateCodeChallenge(method, codeVerifier) {
  return method === 'S256' ? sha256(codeVerifier) : null
}

function keyID(pemPublicKey) {
  const publicKey = crypto.createPublicKey({
    key: pemPublicKey,
    format: 'pem',
    type: 'spki'
  })
  const publicKeyDER = publicKey.export({ type: 'spki', format: 'der' })
  return sha256(publicKeyDER)
}

function sha256(input) {
  const sha256 = crypto.createHash('sha256').update(input).digest()
  return sha256
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

export {
  loadKeyPair,
  generateRandomKeypair,
  JWKS,
  generateTokens,
  generateCodeChallenge,
  sha256
}
