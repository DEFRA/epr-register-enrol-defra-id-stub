import Joi from 'joi'

import { config } from '#/config/config.js'
import { buildErrorDetails } from '#/server/common/helpers/build-error-details.js'
import { getExternalBaseUrl } from '#/server/oidc/helpers/base-urls.js'
import { renderLoginPage } from '#/server/oidc/helpers/render-login-page.js'
import { loginFormValidation } from '#/server/oidc/helpers/schemas/login-form-validation.js'
import { loginValidation } from '#/server/oidc/helpers/schemas/login-validation.js'
import { newSession } from '#/server/oidc/helpers/session-store.js'
import {
  findAllUsers,
  findTemporaryUsers,
  findUser
} from '#/server/oidc/helpers/users.js'
import { validateScope } from '#/server/oidc/helpers/validate-scope.js'
import { oidcConfig } from '#/server/oidc/oidc-config.js'
import { findRelationships } from '#/server/registration/helpers/find-relationships.js'
import { registrationAction } from '#/server/registration/helpers/registration-paths.js'

// Checks an authorization request against the one client the stub serves.
// Returns an error message, or null when the request is acceptable.
function validateOidcRequest(
  {
    clientId,
    redirectUri,
    responseType,
    scope,
    codeChallenge,
    codeChallengeMethod
  },
  logger
) {
  if (clientId !== oidcConfig.clientId) {
    logger.warn('authorize: unknown client_id')
    return 'Unknown client_id'
  }

  if (redirectUri !== oidcConfig.redirectUri) {
    logger.warn('authorize: redirect_uri is not registered for the client')
    return 'Invalid redirect_uri'
  }

  if (!oidcConfig.responseTypesSupported.includes(responseType)) {
    return `Unsupported response_type ${responseType}`
  }

  const unsupportedScopes = validateScope(scope)
  if (unsupportedScopes.length > 0) {
    return `Unsupported scopes ${unsupportedScopes.join(',')}`
  }

  if (!scope.split(' ').includes('openid')) {
    return 'scope must include openid'
  }

  if (
    !codeChallenge ||
    !oidcConfig.codeChallengeMethodsSupported.includes(codeChallengeMethod)
  ) {
    return 'PKCE is required: send code_challenge with code_challenge_method S256'
  }

  return null
}

const toOidcRequest = (params) => ({
  clientId: params.client_id,
  redirectUri: params.redirect_uri,
  responseType: params.response_type,
  scope: params.scope,
  state: params.state,
  nonce: params.nonce,
  serviceId: params.serviceId || undefined,
  codeChallenge: params.code_challenge,
  codeChallengeMethod: params.code_challenge_method,
  forceReselection: params.forceReselection === 'true'
})

// Rebuilds the original /authorize URL from a POST /login payload's hidden
// OIDC fields, so "New registration" (reached from a re-rendered login form)
// can thread back through the full authorize flow rather than dropping to
// the client's bare redirect_uri. Returns null for a standalone login (no
// active OIDC request to preserve).
function rebuildOriginalAuthorizeUrl(payload) {
  const {
    client_id: clientId,
    response_type: responseType,
    redirect_uri: redirectUri,
    state,
    scope,
    nonce,
    code_challenge: codeChallenge,
    code_challenge_method: codeChallengeMethod,
    forceReselection,
    serviceId
  } = payload

  if (!clientId || !responseType || !redirectUri || !state || !scope) {
    return null
  }

  const url = new URL(`${getExternalBaseUrl()}/authorize`)
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('response_type', responseType)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('state', state)
  url.searchParams.set('scope', scope)
  if (nonce) {
    url.searchParams.set('nonce', nonce)
  }
  if (codeChallenge) {
    url.searchParams.set('code_challenge', codeChallenge)
  }
  if (codeChallengeMethod) {
    url.searchParams.set('code_challenge_method', codeChallengeMethod)
  }
  if (forceReselection) {
    url.searchParams.set('forceReselection', forceReselection)
  }
  if (serviceId) {
    url.searchParams.set('serviceId', serviceId)
  }
  return url.toString()
}

async function completeAuthorization(request, h, user, oidcRequest) {
  request.yar.set('authenticated_user', user.email)

  const session = await newSession({ ...oidcRequest, user })

  const relationships = await findRelationships(
    user.userId,
    request.registrationsStore
  )

  if (relationships && relationships.length > 0 && !session.relationshipId) {
    request.logger.info(
      { userId: user.userId, relationshipCount: relationships.length },
      'User has relationships, redirect to organisation picker'
    )
    return h.redirect(`/organisations?sessionId=${session.sessionId}`)
  }

  const location = new URL(oidcRequest.redirectUri)
  location.searchParams.append('code', session.sessionId)
  location.searchParams.append('state', oidcRequest.state)
  request.logger.info('Authenticated, redirecting to the client')
  return h.redirect(location.toString())
}

const authorizeController = {
  handler: async (request, h) => {
    const validationResult = loginValidation.validate(request.query, {
      abortEarly: false
    })

    if (validationResult?.error) {
      request.logger.warn(validationResult?.error, 'Login query error')
      const errorDetails = buildErrorDetails(validationResult.error.details)

      const errorMessages = Object.entries(errorDetails)
        .map(([field, error]) => `${field}: ${error.message}`)
        .join(', ')

      return h.response(`Unsupported payload: ${errorMessages}`).code(400)
    }

    // Reject a bad authorization request before showing any login page.
    const oidcRequest = toOidcRequest(request.query)
    const validationError = validateOidcRequest(oidcRequest, request.logger)
    if (validationError) {
      return h.response(validationError).code(400)
    }

    const originalAuthorizeUrl = `${getExternalBaseUrl()}${request.path}${request.url.search}`

    // Check for cached authenticated user in session (SSO behavior)
    const cachedUserEmail = request.yar.get('authenticated_user')
    const queryUser = request.query.user
    const showLoginEnabled = config.get('oidc.showLogin')

    // Login is email-only (no password), so the "?user=email" shortcut works
    // for any known user (permanent or temporary) even with interactive
    // login enabled - it's how the registration summary page's "login" link
    // completes the loop.
    const isKnownUserShortcut =
      showLoginEnabled && queryUser
        ? await request.registrationsStore.isEmailTaken(queryUser)
        : false
    const bypassInteractiveLogin = !showLoginEnabled || isKnownUserShortcut

    if (!bypassInteractiveLogin && !cachedUserEmail) {
      request.logger.debug('No cached session, rendering login form')
      const allUsers = await findAllUsers(request.registrationsStore)

      if (allUsers.length === 0) {
        request.logger.info('No users found, redirect to register page')
        return h.redirect(registrationAction(originalAuthorizeUrl))
      }

      const temporaryUsers = await findTemporaryUsers(
        request.registrationsStore
      )

      return renderLoginPage(h, {
        oidcParams: request.query,
        allUsers: temporaryUsers,
        newRegistrationLink: registrationAction(originalAuthorizeUrl)
      })
    }

    // Use cached user email if no user query param provided (SSO behavior)
    const loginUser = queryUser || cachedUserEmail
    const user = await findUser(loginUser, request.registrationsStore)
    if (user === undefined) {
      request.logger.error('Invalid user selected')
      return h.response(`Invalid user selection!`).code(400)
    }

    return completeAuthorization(request, h, user, oidcRequest)
  }
}

const loginController = {
  options: {
    validate: {
      query: Joi.object({
        redirect_uri: Joi.string().uri().optional()
      })
    }
  },
  handler: async (request, h) => {
    const redirectUri = request.query.redirect_uri
    const allUsers = await findAllUsers(request.registrationsStore)

    if (allUsers.length === 0) {
      request.logger.info('No users found, redirect to register page')
      return h.redirect(registrationAction(redirectUri))
    }

    const temporaryUsers = await findTemporaryUsers(request.registrationsStore)

    return renderLoginPage(h, {
      oidcParams: request.query,
      allUsers: temporaryUsers,
      newRegistrationLink: registrationAction(redirectUri)
    })
  }
}

const loginSubmitController = {
  handler: async (request, h) => {
    const payload = request?.payload ?? {}
    const temporaryUsers = await findTemporaryUsers(request.registrationsStore)
    const newRegistrationLink = registrationAction(
      rebuildOriginalAuthorizeUrl(payload) ?? payload.redirect_uri
    )

    const validationResult = loginFormValidation.validate(payload, {
      abortEarly: false
    })

    if (validationResult?.error) {
      const formErrors = buildErrorDetails(validationResult.error.details)
      return renderLoginPage(h, {
        oidcParams: payload,
        allUsers: temporaryUsers,
        email: payload.email,
        formErrors,
        newRegistrationLink
      })
    }

    const user = await findUser(payload.email, request.registrationsStore)

    if (!user) {
      request.logger.warn('Invalid login attempt')
      return renderLoginPage(h, {
        oidcParams: payload,
        allUsers: temporaryUsers,
        email: payload.email,
        formErrors: {
          email: { message: 'No account found for this email address' }
        },
        newRegistrationLink
      })
    }

    const oidcRequest = toOidcRequest(payload)

    // Standalone login (not part of an active OIDC request, e.g. from the
    // home page) - just establish the SSO session and go home.
    if (
      !oidcRequest.clientId ||
      !oidcRequest.responseType ||
      !oidcRequest.redirectUri ||
      !oidcRequest.state ||
      !oidcRequest.scope
    ) {
      request.yar.set('authenticated_user', user.email)
      return h.redirect('/')
    }

    const validationError = validateOidcRequest(oidcRequest, request.logger)
    if (validationError) {
      return h.response(validationError).code(400)
    }

    return completeAuthorization(request, h, user, oidcRequest)
  }
}

export { authorizeController, loginController, loginSubmitController }
