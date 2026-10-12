import { getExternalBaseUrl } from '#/server/oidc/helpers/base-urls.js'
import { includeRedirect } from '#/server/registration/helpers/include-redirect.js'

function showLoginPath(redirectUri) {
  return includeRedirect(`/login`, redirectUri)
}
function authorizePath(email, redirectUri) {
  const authorizeUrl = new URL(redirectUri, getExternalBaseUrl())
  authorizeUrl.searchParams.append('user', email)
  return authorizeUrl.toString()
}

function registrationPath(userId, redirectUri) {
  return includeRedirect(`/register/${userId}`, redirectUri)
}

function registrationAction(redirectUri) {
  return includeRedirect(`/register`, redirectUri)
}

function relationshipPath(userId, redirectUri) {
  return includeRedirect(`/register/${userId}/relationship`, redirectUri)
}

function summaryPath(userId, redirectUri) {
  return includeRedirect(`/register/${userId}/summary`, redirectUri)
}

function updateRegistrationAction(userId) {
  return `/register/${userId}/update`
}

function roleNamePath(userId, relationshipId, redirectUri) {
  return includeRedirect(
    `/register/${userId}/relationship/${relationshipId}/role-name`,
    redirectUri
  )
}

export {
  authorizePath,
  registrationAction,
  registrationPath,
  relationshipPath,
  roleNamePath,
  showLoginPath,
  summaryPath,
  updateRegistrationAction
}
