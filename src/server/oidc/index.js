import { config } from '#/config/config.js'
import {
  authorizeController,
  loginController,
  loginSubmitController
} from '#/server/oidc/controllers/authorize-controller.js'
import { logoutController } from '#/server/oidc/controllers/logout-controller.js'
import {
  selectOrganisationController,
  showOrganisationPickerController
} from '#/server/oidc/controllers/organisation-controller.js'
import { tokenController } from '#/server/oidc/controllers/token-controller.js'
import { jwksController } from '#/server/oidc/controllers/well-known-jwks.js'
import { openIdConfigurationController } from '#/server/oidc/controllers/well-known-openid-configuration.js'
import {
  generateRandomKeypair,
  loadKeyPair
} from '#/server/oidc/helpers/oidc-crypto.js'
import { initSessionStore } from '#/server/oidc/helpers/session-store.js'
import { oidcConfig } from '#/server/oidc/oidc-config.js'

// The stub runs as a single instance and keeps everything in memory, so a
// key pair generated at boot is enough. A restart publishes a new key; the
// Operator Journey refetches the JWKS when it sees an unknown kid.
function resolveKeys(logger) {
  const cfgPubKey = config.get('oidc.publicKeyBase64')
  const cfgPrivKey = config.get('oidc.privateKeyBase64')

  if (cfgPubKey && cfgPrivKey) {
    logger.info('loading signing keys from config')
    return loadKeyPair(
      Buffer.from(cfgPubKey, 'base64'),
      Buffer.from(cfgPrivKey, 'base64')
    )
  }
  logger.info('generating signing keys')
  return generateRandomKeypair()
}

const oidc = {
  plugin: {
    name: 'oidc',
    register: (server) => {
      const keys = resolveKeys(server.logger)
      server.decorate('server', 'keys', keys)
      server.decorate('request', 'keys', keys)

      initSessionStore(server, oidcConfig.ttl * 1000)

      server.route([
        {
          method: 'GET',
          path: '/.well-known/openid-configuration',
          ...openIdConfigurationController
        },
        {
          method: 'GET',
          path: oidcConfig.jwksEndpoint,
          ...jwksController
        },
        {
          method: 'GET',
          path: oidcConfig.authorizationEndpoint,
          ...authorizeController
        },
        {
          method: 'GET',
          path: '/login',
          ...loginController
        },
        {
          method: 'POST',
          path: '/login',
          ...loginSubmitController
        },
        {
          method: 'GET',
          path: '/organisations',
          ...showOrganisationPickerController
        },
        {
          method: 'POST',
          path: '/organisations',
          ...selectOrganisationController
        },
        {
          method: 'POST',
          path: oidcConfig.tokenEndpoint,
          ...tokenController
        },
        {
          method: 'GET',
          path: oidcConfig.endSessionEndpoint,
          ...logoutController
        }
      ])
    }
  }
}

export { oidc }
