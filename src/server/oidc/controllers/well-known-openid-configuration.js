import {
  getExternalBaseUrl,
  getInternalBaseUrl
} from '#/server/oidc/helpers/base-urls.js'
import { oidcConfig } from '#/server/oidc/oidc-config.js'

// Advertises only what the stub implements.
const buildOpenIdConfiguration = () => {
  const externalBaseUrl = getExternalBaseUrl()
  const internalBaseUrl = getInternalBaseUrl()

  return {
    issuer: externalBaseUrl,
    authorization_endpoint: `${externalBaseUrl}${oidcConfig.authorizationEndpoint}`,
    token_endpoint: `${internalBaseUrl}${oidcConfig.tokenEndpoint}`,
    jwks_uri: `${internalBaseUrl}${oidcConfig.jwksEndpoint}`,
    end_session_endpoint: `${externalBaseUrl}${oidcConfig.endSessionEndpoint}`,

    grant_types_supported: oidcConfig.grantTypesSupported,
    response_types_supported: oidcConfig.responseTypesSupported,
    subject_types_supported: oidcConfig.subjectTypesSupported,
    id_token_signing_alg_values_supported:
      oidcConfig.idTokenSigningAlgValuesSupported,
    scopes_supported: oidcConfig.scopesSupported,
    token_endpoint_auth_methods_supported:
      oidcConfig.tokenEndpointAuthMethodsSupported,
    claims_supported: oidcConfig.claimsSupported,
    code_challenge_methods_supported: oidcConfig.codeChallengeMethodsSupported
  }
}

const openIdConfigurationController = {
  handler: (request, h) => {
    return h.response(buildOpenIdConfiguration()).code(200)
  }
}

export { openIdConfigurationController }
