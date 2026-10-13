# epr-register-enrol-defra-id-stub

A Defra ID OIDC stub for the EPR Register **Operator Journey** frontend
([epr-register-enrol-frontend](https://github.com/DEFRA/epr-register-enrol-frontend)). It lets testers sign in to the
Operator Journey through its real Defra ID code path (authorization code + PKCE S256, a signed `id_token` checked
against the JWKS, issuer, audience and nonce, and RP-initiated logout) without real Defra ID accounts.

It runs on CDP **test** and locally (Docker Compose). It is forked from
[DEFRA/epr-re-ex-defra-id-stub](https://github.com/DEFRA/epr-re-ex-defra-id-stub), with its history kept.

- [How the Operator Journey uses it](#how-the-operator-journey-uses-it)
- [Signing in on CDP test](#signing-in-on-cdp-test)
- [Endpoints](#endpoints)
- [Configuration](#configuration)
- [Users](#users)
- [Deploy notes](#deploy-notes)
- [Local development](#local-development)
- [Licence](#licence)

## How the Operator Journey uses it

The Operator Journey chooses its login with `AUTH_STUB_ENABLED`:

| `AUTH_STUB_ENABLED` | `DEFRA_ID_DISCOVERY_URL` / `DEFRA_ID_CLIENT_ID` set | Login                                                                         |
| ------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------- |
| `true`              | no                                                  | The Operator Journey's built-in stub chooser only                             |
| `true`              | yes                                                 | The stub chooser, plus a **Sign in with Defra ID** button that uses this stub |
| `false`             | yes                                                 | Defra ID (this stub) is the only login                                        |

To point the Operator Journey at the stub, set:

| Operator Journey variable | Value                                                         |
| ------------------------- | ------------------------------------------------------------- |
| `DEFRA_ID_DISCOVERY_URL`  | `<stub URL>/.well-known/openid-configuration`                 |
| `DEFRA_ID_CLIENT_ID`      | the stub's `OJ_CLIENT_ID`                                     |
| `DEFRA_ID_CLIENT_SECRET`  | the stub's `OJ_CLIENT_SECRET`                                 |
| `AUTH_CALLBACK_BASE_URL`  | the stub's `CALLBACK_OJ_URL` (the Operator Journey's own URL) |

### Organisation access

The Operator Journey lets an operator into a Re-Ex organisation only when one of the user's Defra ID `relationships`
has the Defra organisation id that Re-Ex links to that organisation. Each relationship in the `id_token` is
`relationshipId:organisationId:organisationName:0:relationshipRole:0`, and the Operator Journey reads the
`organisationId`. So a stub user needs a relationship whose **organisation ID** is the linked Defra organisation id.

Users sign in to the Operator Journey and to Re-Ex separately: there is no single sign-on between them.

## Signing in on CDP test

1. Find the Defra organisation id that Re-Ex has linked to the organisation you want to test (the Re-Ex
   organisation's `linkedDefraOrganisation.orgId`; the Operator Journey backend reads it through
   `GET /api/v1/organisations/{id}/defra-link`).
2. Open the Operator Journey on test, choose **Sign in with Defra ID**, then **New registration** on the stub's login
   page.
3. Enter the user's details, then add a relationship: set **Organisation ID** to the linked Defra organisation id,
   with any organisation name and role.
4. Finish the registration and sign in. The stub returns you to the Operator Journey signed in as that user.

Registrations are kept in memory for `REGISTRATIONS_STORE_TTL` (3 days by default) and are lost when the stub
restarts or is redeployed. Sign-in is email only (no password). A registered user can sign in again from the login
page by email.

Journey tests can create users without the UI: `POST /API/register` takes a JSON registration (`email`, `firstName`,
`lastName`, `loa`, `enrolmentCount`, `enrolmentRequestCount` and `relationships` with `organisationId`,
`organisationName` and `relationshipRole`), and `/authorize?...&user=<email>` signs that user straight in.

## Endpoints

| Endpoint                                 | Purpose                                                                                                                                                                                                                                                                                                              |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /.well-known/openid-configuration`  | Discovery. The issuer, `authorization_endpoint` and `end_session_endpoint` use `STUB_EXTERNAL_URL`; `token_endpoint` and `jwks_uri` use `STUB_INTERNAL_URL`. Only what is implemented is advertised.                                                                                                                 |
| `GET /.well-known/jwks.json`             | The public RS256 signing key.                                                                                                                                                                                                                                                                                        |
| `GET /authorize`                         | Accepts only the Operator Journey: exact `client_id` and `redirect_uri` (`${CALLBACK_OJ_URL}/auth/operator/callback`), `response_type=code`, the scopes `openid`, `offline_access` and the bare client id, and PKCE `S256`. It stores `nonce`, `serviceId`, the PKCE challenge and the `redirect_uri` with the code. |
| `GET`/`POST /login`, `/organisations`    | The email login page and the organisation picker (shown when a user has more than one relationship).                                                                                                                                                                                                                 |
| `POST /token`                            | `client_secret_post` only. Codes are single use and bound to the client and `redirect_uri`; PKCE is verified. Returns `access_token` and an `id_token` with the `/authorize` nonce. Errors are RFC 6749 JSON (`invalid_client`, `invalid_grant`, `unsupported_grant_type`). No refresh tokens.                       |
| `GET /logout`                            | End session. Redirects only to `${CALLBACK_OJ_URL}/auth/logout?userType=operator`, by exact match.                                                                                                                                                                                                                   |
| `/register/...`, `POST /API/register...` | Registration UI and API.                                                                                                                                                                                                                                                                                             |
| `GET /health`                            | CDP health check.                                                                                                                                                                                                                                                                                                    |

The `id_token` claims are `iss`, `aud`, `sub`, `iat`, `nbf`, `exp`, `nonce`, `email`, `firstName`, `lastName`,
`contactId`, `serviceId` (echoed from `/authorize`), `uniqueReference`, `loa`, `aal`, `enrolmentCount`,
`enrolmentRequestCount`, `currentRelationshipId`, `relationships` and `roles`.

## Configuration

| Variable                                       | Default                        | Set on CDP test                                                                 |
| ---------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------- |
| `STUB_EXTERNAL_URL`                            | `http://localhost:3000`        | app-config: `https://epr-register-enrol-defra-id-stub.test.cdp-int.defra.cloud` |
| `STUB_INTERNAL_URL`                            | `STUB_EXTERNAL_URL`            | app-config: same as above                                                       |
| `CALLBACK_OJ_URL`                              | `http://localhost:3000`        | app-config: `https://epr-register-enrol-frontend.test.cdp-int.defra.cloud`      |
| `OJ_CLIENT_ID`                                 | `epr-register-enrol-frontend`  | default                                                                         |
| `OJ_CLIENT_SECRET`                             | `operator-journey-stub-secret` | default                                                                         |
| `USERS_FILE_PATH`                              | unset (no permanent users)     | unset                                                                           |
| `REGISTRATIONS_STORE_TTL`                      | `259200000` (3 days)           | default                                                                         |
| `OIDC_PUBLIC_KEY_B64` / `OIDC_PRIVATE_KEY_B64` | unset (key pair made at boot)  | unset                                                                           |
| `OIDC_SHOW_LOGIN`                              | `true`                         | default                                                                         |

`OJ_CLIENT_ID` and `OJ_CLIENT_SECRET` must match the Operator Journey's `DEFRA_ID_CLIENT_ID` and
`DEFRA_ID_CLIENT_SECRET`. On test both sides use the stub's defaults, set in plain app-config: the
stub's registration is open, so the secret protects nothing, and the values are already public in this repo.

## Users

- **Registered users** are created through the registration UI or `POST /API/register` and kept in memory.
- **Permanent users** load from `USERS_FILE_PATH` when it is set. [`data/local/users.json`](data/local/users.json)
  holds local users whose relationships match the organisations the Operator Journey backend's local Re-Ex stub
  serves (it links each Re-Ex organisation to the Defra organisation with the same id):

  | Email                          | Organisation ID | Organisation             |
  | ------------------------------ | --------------- | ------------------------ |
  | `newdev.recycling@test.gov.uk` | `50001`         | NEWDEV RECYCLING LIMITED |
  | `beta.recycling@test.gov.uk`   | `50002`         | Beta Recycling Co        |
  | `delta.green@test.gov.uk`      | `50003`         | Delta Green Ltd          |

  Permanent users' emails are not listed on the login page.

## Deploy notes

- Run **one instance**. Sessions, authorization codes, registrations and the signing key are held in memory.
- A restart or redeploy loses registrations and publishes a new signing key. The Operator Journey refetches the JWKS
  when it sees an unknown key id.
- Deploy to **test** only. Never deploy it to production.

## Local development

### With the whole stack

The [epr-register-enrol](https://github.com/DEFRA/epr-register-enrol) superproject's `compose.yml` runs this stub
behind the `defra-id-stub` profile and wires the Operator Journey frontend to it. See its README.

### On its own

Requires Node.js (see [.nvmrc](.nvmrc)).

```bash
npm install
cp .env.example .env
npm run dev
```

Or with Docker: `docker compose up --build`. Both serve the stub at `http://localhost:3200` with the local users.
Point a locally running Operator Journey at `http://localhost:3200/.well-known/openid-configuration`.

### Npm scripts

- `npm run dev`: run with nodemon
- `npm test`: run the tests with coverage
- `npm run lint`, `npm run format:check`: the checks CI runs
- `npm run security-audit`: `npm audit --audit-level=critical`

### Docker

- Development image: `docker build --target development --tag epr-register-enrol-defra-id-stub:development .`
- Production image: `docker build --tag epr-register-enrol-defra-id-stub .`

## Licence

THIS INFORMATION IS LICENSED UNDER THE CONDITIONS OF THE OPEN GOVERNMENT LICENCE found at:

<http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3>

The following attribution statement MUST be cited in your products and applications when using this information.

> Contains public sector information licensed under the Open Government license v3

### About the licence

The Open Government Licence (OGL) was developed by the Controller of Her Majesty's Stationery Office (HMSO) to enable
information providers in the public sector to license the use and re-use of their information under a common open
licence.

It is designed to encourage use and re-use of information freely and flexibly, with only a few conditions.
