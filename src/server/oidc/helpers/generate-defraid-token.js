import { createLogger } from '#/server/common/helpers/logging/logger.js'
import { getExternalBaseUrl } from '#/server/oidc/helpers/base-urls.js'
import { oidcConfig } from '#/server/oidc/oidc-config.js'
import { randomUUID } from 'node:crypto'
import { findRegistrationByEmail } from '#/server/registration/helpers/find-registration.js'
import { findRelationships } from '#/server/registration/helpers/find-relationships.js'

const logger = createLogger()

// The Defra ID claims the Operator Journey reads: sub, email, firstName,
// lastName, contactId, currentRelationshipId, relationships and roles.
// Each relationship is "relationshipId:organisationId:organisationName:..."
// and the Operator Journey takes the organisationId (segment 1) to match the
// Defra organisation Re-Ex links to the operator's organisation.
export async function generateDefraIdToken(session, store) {
  const email = session.user?.email
  if (!email) {
    logger.warn('No email found for user')
    return null
  }

  const registration = await findRegistrationByEmail(email, store)
  if (!registration) {
    logger.warn('No registration found for user email')
    return null
  }

  const relationships = await findRelationships(registration.userId, store)

  const relationshipIdsRow = relationships.map(
    (r) =>
      `${r.relationshipId}:${r.organisationId}:` +
      `${r.organisationName}:0:${r.relationshipRole}:0`
  )
  const rolesRow = relationships
    .filter((r) => r.roleName)
    .map((r) => `${r.relationshipId}:${r.roleName}:${r.roleStatus}`)

  // Use session's selected relationship if available, otherwise fall back to registration's current
  const currentRelationshipId =
    session.relationshipId || registration.currentRelationshipId

  // Token timestamps, in seconds
  const now = Math.floor(Date.now() / 1000)

  return {
    iss: getExternalBaseUrl(),
    aud: oidcConfig.clientId,
    sub: registration.userId,
    iat: now,
    nbf: now,
    exp: now + oidcConfig.ttl,
    jti: randomUUID(),
    correlationId: randomUUID(),
    sessionId: session.sessionId,
    contactId: registration.contactId,
    // Echoes the serviceId the client sent to /authorize, as Defra ID does.
    // Omitted when the client sent none.
    serviceId: session.serviceId,
    firstName: registration.firstName,
    lastName: registration.lastName,
    email,
    uniqueReference: registration.uniqueReference,
    loa: registration.loa,
    aal: registration.aal,
    enrolmentCount: registration.enrolmentCount,
    enrolmentRequestCount: registration.enrolmentRequestCount,
    currentRelationshipId,
    relationships: relationshipIdsRow,
    roles: rolesRow
  }
}
