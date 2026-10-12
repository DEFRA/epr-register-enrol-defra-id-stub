import Joi from 'joi'

const loginFormValidation = Joi.object({
  email: Joi.string().email().required().messages({
    'string.empty': 'Enter your email address',
    'string.email': 'Enter a valid email address',
    'any.required': 'Enter your email address'
  }),
  client_id: Joi.string().optional(),
  response_type: Joi.string().optional(),
  redirect_uri: Joi.string().uri().optional(),
  state: Joi.string().optional(),
  scope: Joi.string().optional(),
  nonce: Joi.string().optional(),
  code_challenge: Joi.string().optional(),
  code_challenge_method: Joi.string().optional(),
  forceReselection: Joi.string().optional(),
  // The Operator Journey sends an empty serviceId when DEFRA_ID_SERVICE_ID
  // is unset.
  serviceId: Joi.string().allow('').optional()
})

export { loginFormValidation }
