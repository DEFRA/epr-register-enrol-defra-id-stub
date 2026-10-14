import { config } from '#/config/config.js'

const clientId = config.get('oidc.clientId')
const callbackUrl = config.get('oidc.callbackUrl')

// The stub has one client: the Operator Journey frontend
// (epr-register-enrol-frontend). Its redirect and post-logout URIs are fixed
// by that frontend's Defra ID code, so they are matched exactly.
const oidcConfig = {
  clientId,
  clientSecret: config.get('oidc.clientSecret'),
  redirectUri: `${callbackUrl}/auth/operator/callback`,
  postLogoutRedirectUri: `${callbackUrl}/auth/logout?userType=operator`,

  authorizationEndpoint: '/authorize',
  tokenEndpoint: '/token',
  jwksEndpoint: '/.well-known/jwks.json',
  endSessionEndpoint: '/logout',

  // The Operator Journey asks for "openid offline_access <client id>", as
  // real Defra ID expects. offline_access is accepted, but no refresh token
  // is issued: the Operator Journey never uses one.
  scopesSupported: ['openid', 'offline_access', clientId],
  responseTypesSupported: ['code'],
  grantTypesSupported: ['authorization_code'],
  subjectTypesSupported: ['public'],
  idTokenSigningAlgValuesSupported: ['RS256'],
  tokenEndpointAuthMethodsSupported: ['client_secret_post'],
  codeChallengeMethodsSupported: ['S256'],
  claimsSupported: [
    'iss',
    'aud',
    'sub',
    'iat',
    'nbf',
    'exp',
    'nonce',
    'email',
    'firstName',
    'lastName',
    'contactId',
    'serviceId',
    'uniqueReference',
    'loa',
    'aal',
    'enrolmentCount',
    'enrolmentRequestCount',
    'currentRelationshipId',
    'relationships',
    'roles'
  ],

  ttl: 3600 // seconds
}

export { oidcConfig }
