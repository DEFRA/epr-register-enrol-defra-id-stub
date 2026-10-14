import {
  showRegistrationController,
  registrationController,
  showExistingRegistrationController,
  updateRegistrationController
} from '#/server/registration/controllers/registration-controller.js'
import { summaryRegistrationController } from '#/server/registration/controllers/summary-controller.js'
import {
  showRelationshipListController,
  addRelationshipController,
  makeCurrentRelationshipController,
  removeRelationshipController
} from '#/server/registration/controllers/relationship-controller.js'
import { expireRegistrationApiController } from '#/server/registration/controllers/expire-registration-api-controller.js'
import { expireRegistrationController } from '#/server/registration/controllers/expire-registration-controller.js'
import { findRegistrationApiController } from '#/server/registration/controllers/find-registration-api-controller.js'
import { registerApiController } from '#/server/registration/controllers/register-api-controller.js'
import {
  addRoleNameController,
  removeRoleNameController,
  showAddRoleNameController
} from '#/server/registration/controllers/role-controller.js'

const registration = {
  plugin: {
    name: 'registration',
    register: async (server) => {
      server.route([
        {
          method: 'GET',
          path: `/register`,
          ...showRegistrationController
        },
        {
          method: 'GET',
          path: `/register/{userId}`,
          ...showExistingRegistrationController
        },
        {
          method: 'POST',
          path: `/register`,
          ...registrationController
        },
        {
          method: 'POST',
          path: `/register/{userId}/update`,
          ...updateRegistrationController
        },
        {
          method: 'GET',
          path: `/register/{userId}/relationship`,
          ...showRelationshipListController
        },
        {
          method: 'POST',
          path: `/register/{userId}/relationship`,
          ...addRelationshipController
        },
        {
          method: 'GET',
          path: `/register/{userId}/relationship/{relationshipId}/remove`,
          ...removeRelationshipController
        },
        {
          method: 'GET',
          path: `/register/{userId}/relationship/{relationshipId}/current`,
          ...makeCurrentRelationshipController
        },
        {
          method: 'GET',
          path: `/register/{userId}/relationship/{relationshipId}/role-name`,
          ...showAddRoleNameController
        },
        {
          method: 'POST',
          path: `/register/{userId}/relationship/{relationshipId}/role-name`,
          ...addRoleNameController
        },
        {
          method: 'GET',
          path: `/register/{userId}/relationship/{relationshipId}/role-name/remove`,
          ...removeRoleNameController
        },
        {
          method: 'GET',
          path: `/register/{userId}/summary`,
          ...summaryRegistrationController
        },
        {
          method: 'GET',
          path: `/API/register/{userId}`,
          ...findRegistrationApiController
        },
        {
          method: 'POST',
          path: `/API/register`,
          ...registerApiController
        },
        {
          method: 'POST',
          path: `/API/register/{userId}/expire`,
          ...expireRegistrationApiController
        },
        {
          method: 'GET',
          path: `/register/{userId}/expire`,
          ...expireRegistrationController
        }
      ])
    }
  }
}

export { registration }
