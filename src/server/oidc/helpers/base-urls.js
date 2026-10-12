import { config } from '#/config/config.js'

// Browser-facing URLs (and the issuer) use the external URL. The token
// endpoint and JWKS are called by the Operator Journey frontend's server, so
// they use the internal URL, which differs only inside Docker Compose.
export const getExternalBaseUrl = () => config.get('stub.externalUrl')

export const getInternalBaseUrl = () =>
  config.get('stub.internalUrl') || getExternalBaseUrl()
