import fs from 'node:fs'

import { createLogger } from '#/server/common/helpers/logging/logger.js'
import { usersFileValidation } from '#/server/registration/helpers/schemas/users-file-validation.js'
import { CombinedRegistrationsStore } from '#/server/registration/store/combined-store.js'
import { FileUsersStore } from '#/server/registration/store/file-store.js'
import { MemoryRegistrationsStore } from '#/server/registration/store/memory-store.js'

const logger = createLogger()

// Permanent users come from USERS_FILE_PATH when it is set (Docker Compose
// sets it to data/local/users.json). On CDP it is unset: testers register.
function loadPermanentUsersStore(config) {
  const filePath = config.get('usersFile')
  if (!filePath) {
    logger.info('USERS_FILE_PATH not set, no permanent users')
    return new FileUsersStore([])
  }

  const raw = fs.readFileSync(filePath, 'utf-8')
  const users = JSON.parse(raw)
  const { error, value } = usersFileValidation.validate(users, {
    abortEarly: false
  })

  if (error) {
    throw new Error(`Invalid users file at ${filePath}: ${error.message}`)
  }

  logger.info(
    { filePath, count: value.length },
    'Loaded permanent users from file'
  )
  return new FileUsersStore(value)
}

// Registrations made through the stub are held in memory, so the stub must
// run as a single instance and they are lost when it restarts.
function createRegistrationsStore(config) {
  return new CombinedRegistrationsStore({
    permanentStore: loadPermanentUsersStore(config),
    ephemeralStore: new MemoryRegistrationsStore({
      ttlMs: config.get('registrationsStore.ttl')
    })
  })
}

export { createRegistrationsStore }
