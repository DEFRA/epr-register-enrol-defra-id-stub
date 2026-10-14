import { randomUUID } from 'node:crypto'

function normalizeEmail(email) {
  return String(email ?? '')
    .trim()
    .toLowerCase()
}

// The USERS_FILE_PATH file only supplies organisationId (and optionally
// organisationName) per user - the rest of the
// relationship shape is generated so the token/organisation-picker code
// (which expects the full DEFRA ID relationship object) keeps working.
function buildRelationships(organisationId, organisationName) {
  if (!organisationId) {
    return []
  }

  return [
    {
      relationshipId: randomUUID(),
      organisationId,
      organisationName: organisationName ?? 'Test Organisation',
      relationshipRole: 'Employee',
      roleName: 'Full Access',
      roleStatus: '1'
    }
  ]
}

class FileUsersStore {
  constructor(users = []) {
    this.usersById = new Map()
    this.userIdByEmail = new Map()

    for (const { organisationId, organisationName, ...rest } of users) {
      const relationships = buildRelationships(organisationId, organisationName)
      const profile = {
        loa: '1',
        aal: '1',
        enrolmentCount: 1,
        enrolmentRequestCount: 1,
        ...rest,
        firstName: 'Test',
        lastName: 'User',
        contactId: randomUUID(),
        uniqueReference: randomUUID(),
        currentRelationshipId: relationships[0]?.relationshipId
      }

      this.usersById.set(profile.userId, { profile, relationships })
      this.userIdByEmail.set(normalizeEmail(profile.email), profile.userId)
    }
  }

  async getRegistration(userId) {
    const entry = this.usersById.get(userId)
    return entry ? { ...entry.profile } : undefined
  }

  async listRegistrations() {
    return Array.from(this.usersById.values()).map((entry) => ({
      ...entry.profile
    }))
  }

  async findRegistrationByEmail(email) {
    const userId = this.userIdByEmail.get(normalizeEmail(email))
    return userId ? this.getRegistration(userId) : undefined
  }

  async getRelationship(userId, relationshipId) {
    const entry = this.usersById.get(userId)
    return entry?.relationships.find(
      (relationship) => relationship.relationshipId === relationshipId
    )
  }

  async listRelationships(userId) {
    const entry = this.usersById.get(userId)
    return entry ? [...entry.relationships] : []
  }
}

export { FileUsersStore }
