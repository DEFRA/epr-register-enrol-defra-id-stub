import { oidcConfig } from '#/server/oidc/oidc-config.js'

// End-session endpoint. Only the Operator Journey's own post-logout URI is
// accepted, by exact match, so the stub cannot be used as an open redirect.
const logoutController = {
  handler: (request, h) => {
    const redirect = request.query.post_logout_redirect_uri

    if (redirect !== oidcConfig.postLogoutRedirectUri) {
      request.logger.warn('logout: rejected post_logout_redirect_uri')
      return h.response('Invalid post_logout_redirect_uri').code(400)
    }

    request.yar.clear('authenticated_user')
    return h.redirect(redirect)
  }
}

export { logoutController }
