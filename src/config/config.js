import convict from 'convict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import convictFormatWithValidator from 'convict-format-with-validator'

const dirname = path.dirname(fileURLToPath(import.meta.url))

const fourHoursMs = 14400000
const oneWeekMs = 604800000
const oneDayMs = 86400000
const threeDaysMs = oneDayMs * 3

const isProduction = process.env.NODE_ENV === 'production'
const isTest = process.env.NODE_ENV === 'test'
const isDevelopment = process.env.NODE_ENV === 'development'

convict.addFormats(convictFormatWithValidator)

export const config = convict({
  serviceVersion: {
    doc: 'The service version, this variable is injected into your docker container in CDP environments',
    format: String,
    nullable: true,
    default: null,
    env: 'SERVICE_VERSION'
  },
  host: {
    doc: 'The IP address to bind',
    format: 'ipaddress',
    default: '0.0.0.0',
    env: 'HOST'
  },
  port: {
    doc: 'The port to bind.',
    format: 'port',
    default: 3000,
    env: 'PORT'
  },
  staticCacheTimeout: {
    doc: 'Static cache timeout in milliseconds',
    format: Number,
    default: oneWeekMs,
    env: 'STATIC_CACHE_TIMEOUT'
  },
  serviceName: {
    doc: 'Applications Service Name',
    format: String,
    default: 'epr-register-enrol-defra-id-stub'
  },
  root: {
    doc: 'Project root',
    format: String,
    default: path.resolve(dirname, '../..')
  },
  assetPath: {
    doc: 'Asset path',
    format: String,
    default: '/public',
    env: 'ASSET_PATH'
  },
  isProduction: {
    doc: 'If this application running in the production environment',
    format: Boolean,
    default: isProduction
  },
  isDevelopment: {
    doc: 'If this application running in the development environment',
    format: Boolean,
    default: isDevelopment
  },
  isTest: {
    doc: 'If this application running in the test environment',
    format: Boolean,
    default: isTest
  },
  log: {
    enabled: {
      doc: 'Is logging enabled',
      format: Boolean,
      default: process.env.NODE_ENV !== 'test',
      env: 'LOG_ENABLED'
    },
    level: {
      doc: 'Logging level',
      format: ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'],
      default: 'info',
      env: 'LOG_LEVEL'
    },
    format: {
      doc: 'Format to output logs in.',
      format: ['ecs', 'pino-pretty'],
      default: isProduction ? 'ecs' : 'pino-pretty',
      env: 'LOG_FORMAT'
    },
    redact: {
      doc: 'Log paths to redact',
      format: Array,
      default: isProduction
        ? ['req.headers.authorization', 'req.headers.cookie', 'res.headers']
        : [],
      env: 'LOG_REDACT'
    }
  },
  httpProxy: {
    doc: 'HTTP Proxy',
    format: String,
    nullable: true,
    default: null,
    env: 'HTTP_PROXY'
  },
  isSecureContextEnabled: {
    doc: 'Enable Secure Context',
    format: Boolean,
    default: isProduction,
    env: 'ENABLE_SECURE_CONTEXT'
  },
  session: {
    cache: {
      name: {
        doc: 'server side session cache name',
        format: String,
        default: 'session',
        env: 'SESSION_CACHE_NAME'
      },
      ttl: {
        doc: 'server side session cache ttl',
        format: Number,
        default: fourHoursMs,
        env: 'SESSION_CACHE_TTL'
      }
    },
    cookie: {
      ttl: {
        doc: 'Session cookie ttl',
        format: Number,
        default: fourHoursMs,
        env: 'SESSION_COOKIE_TTL'
      },
      password: {
        doc: 'session cookie password',
        format: String,
        default: 'the-password-must-be-at-least-32-characters-long',
        env: 'SESSION_COOKIE_PASSWORD',
        sensitive: true
      },
      secure: {
        doc: 'set secure flag on cookie',
        format: Boolean,
        default: isProduction,
        env: 'SESSION_COOKIE_SECURE'
      }
    }
  },
  nunjucks: {
    watch: {
      doc: 'Reload templates when they are changed.',
      format: Boolean,
      default: isDevelopment
    },
    noCache: {
      doc: 'Use a cache and recompile templates each time',
      format: Boolean,
      default: isDevelopment
    }
  },
  tracing: {
    header: {
      doc: 'Which header to track',
      format: String,
      default: 'x-cdp-request-id',
      env: 'TRACING_HEADER'
    }
  },
  usersFile: {
    doc: 'Optional JSON file of permanent stub users (userId, email, organisationId, organisationName). Unset means no permanent users: testers register their own.',
    format: String,
    nullable: true,
    default: null,
    env: 'USERS_FILE_PATH'
  },
  registrationsStore: {
    ttl: {
      doc: 'How long a registration made through the stub is kept, in milliseconds. Registrations are held in memory and are lost when the stub restarts.',
      format: Number,
      default: threeDaysMs,
      env: 'REGISTRATIONS_STORE_TTL'
    }
  },
  stub: {
    externalUrl: {
      doc: 'Base URL browsers use to reach the stub. It is also the issuer, so it must match the iss the Operator Journey frontend expects.',
      format: String,
      default: 'http://localhost:3000',
      env: 'STUB_EXTERNAL_URL'
    },
    internalUrl: {
      doc: 'Base URL the Operator Journey frontend server uses for the token endpoint and the JWKS. Defaults to STUB_EXTERNAL_URL; set it when the frontend reaches the stub by a different host (for example inside Docker Compose).',
      format: String,
      nullable: true,
      default: null,
      env: 'STUB_INTERNAL_URL'
    }
  },
  oidc: {
    clientId: {
      doc: "The Operator Journey frontend's client id (its DEFRA_ID_CLIENT_ID). The only client the stub accepts.",
      format: String,
      default: 'epr-register-enrol-frontend',
      env: 'OJ_CLIENT_ID'
    },
    clientSecret: {
      doc: "The Operator Journey frontend's client secret (its DEFRA_ID_CLIENT_SECRET).",
      format: String,
      default: 'operator-journey-stub-secret',
      sensitive: true,
      env: 'OJ_CLIENT_SECRET'
    },
    callbackUrl: {
      doc: "The Operator Journey frontend's public base URL (its AUTH_CALLBACK_BASE_URL). The redirect and post-logout URIs are built from it.",
      format: String,
      default: 'http://localhost:3000',
      env: 'CALLBACK_OJ_URL'
    },
    publicKeyBase64: {
      doc: 'Base64-encoded public signing key (PEM). Optional: without it a key pair is generated at boot.',
      format: String,
      default: undefined,
      env: 'OIDC_PUBLIC_KEY_B64'
    },
    privateKeyBase64: {
      doc: 'Base64-encoded private signing key (PEM). Set together with OIDC_PUBLIC_KEY_B64.',
      format: String,
      default: undefined,
      sensitive: true,
      env: 'OIDC_PRIVATE_KEY_B64'
    },
    showLogin: {
      doc: 'if set, shows login page, else it auto logs in as admin',
      format: Boolean,
      default: true,
      env: 'OIDC_SHOW_LOGIN'
    }
  }
})

config.validate({ allowed: 'strict' })
