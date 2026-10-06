# Email channel (Resend)

A `RESEND` connection sends email through the [Resend](https://resend.com) API. Today it sends team invitations.

## Setting it up

An organization owner adds a Resend credential in Settings › Credentials, then picks it in Settings › Organizations › the organization › Email channel. Over the API:

1. Store the API key as a bearer credential tagged as Resend. The app lists a credential as Resend only with this tag:

   ```
   POST /api/v1/orgs/{org}/integrations/credential-profiles
   {"displayName": "Resend", "authType": "BEARER_TOKEN", "publicConfig": {"provider": "resend"},
    "secretConfig": {"token": "re_..."}}
   ```

2. Create the connection on it:

   ```
   POST /api/v1/orgs/{org}/integrations/connections
   {"name": "Email", "providerType": "RESEND", "baseUrl": "https://api.resend.com",
    "credentialProfileId": "<id>", "metadata": {"from": "Team <no-reply@your-domain.com>"}}
   ```

3. Test it: `POST /api/v1/orgs/{org}/integrations/connections/{id}/test`.

| Field | Meaning |
|---|---|
| `metadata.from` | The sender. Its domain must be verified in Resend. |
| credential `token` | The Resend API key. A send-only key works. |
| `baseUrl` | `https://api.resend.com`. Any other value is refused. |

The key is only ever sent to `miot.integrations.resend.base-url` (default `https://api.resend.com`), which is server configuration. A connection whose `baseUrl` names another host fails its test and sends nothing.

The test checks the sender, then calls `GET /domains` with the key. It sends no email. A send-only key answers 401 `restricted_api_key`, which counts as a pass. A connection is used only once it is `ACTIVE`, that is, after a passing test.

## Sending

`ResendEmailSender` posts one email per call to `POST /emails` with an `Idempotency-Key`. Resend keeps a key for 24 hours, so a repeated call with the same key sends once. `ResendOrganizationMailer` implements core's `OrganizationMailer` with it; the mailer exists only in builds with `miot.component.integrations.enabled=true`.

| Result | Meaning |
|---|---|
| `SENT` | Resend accepted the email. It does not prove the email reached the inbox. |
| `FAILED` | Resend refused it, or could not be reached. The reason comes back in `detail`. |
| `NOT_CONFIGURED` | The organization has no active `RESEND` connection. |

Invitations fall back to the platform organization's connection; see `miot-core/docs/organization-access.md`.
