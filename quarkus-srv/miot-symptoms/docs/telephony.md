# Telephony for "Llamar a"

The Control Tower places calls through the organization's telephony connection. A connection is created in Conexiones. Its secret is kept in a credential.

| Provider type | Credential | Connection metadata |
| --- | --- | --- |
| `TELNYX` | Telnyx (bearer token, the API key) | `sipConnectionId` (a Credential Connection for WebRTC), `callerNumber` (E.164) |
| `TEAMS_PHONE` | Microsoft Entra app, scope `https://graph.microsoft.com/.default`, application permission CallRecords.Read.All | `defaultCallerId` (E.164, optional) |

For Telnyx, use a Credential Connection made for WebRTC. A Teams Operator Connect connection does not work.

A TELNYX connection can be the organization's own, or the platform's: a TELNYX connection in the Plataforma scope. An organization without its own uses the platform's (the managed line), with one shared caller number, charged per minute. Teams Phone is only the organization's own: its licenses are per user in the organization's Microsoft 365.

Optional TELNYX metadata:

| Key | Purpose |
| --- | --- |
| `channelLimit` | calls at once on the line; default 10 |
| `webhookPublicKey` | Telnyx's webhook public key (ed25519, base64), to verify webhooks |

## Which line calls use

The organization's choice is stored in `tower_settings.telephony_provider`. The line used is:

1. the chosen provider, when its connection passed its test;
2. else Telnyx, when its connection passed its test;
3. else Teams Phone, when its connection passed its test;
4. else no line, and the button opens `tel:`.

## Endpoints

All are under `/api/v1/orgs/{organizationId}/control-tower/telephony`.

| Request | Permission | Result |
| --- | --- | --- |
| `GET` | `controltower:view` | `{preferred, active, lines}` |
| `PUT {provider}` | `controltower:settings.update` | Saves `TELNYX`, `TEAMS_PHONE` or `null` (automatic). |
| `POST /webrtc-token` | `controltower:case.treat` | `{token, callerNumber, expiresAt}` for the operator. 409 when calls do not use Telnyx. |
| `POST /reconcile` | `controltower:case.treat` | `{checked, recorded, pending}` for the operator's pending Teams calls. |
| `POST /calls/{callRef}/ended {providerCallId}` | `controltower:case.treat` | The browser's call ended: frees its channel. |

The token request takes `{calleeNumber, caseRef}` and answers `callRef`. A 409 carries `code`:

| Code | When |
| --- | --- |
| `telephony_quota_exhausted` | the managed line, the plan is enforced, and the organization used its minutes |
| `telephony_channels_busy` | `channelLimit` calls are on the line |
| `telephony_unavailable` | no Telnyx line, or Telnyx refused |

The app then says why and offers `tel:`.

## Telnyx calls

The browser gets a token and dials with `@telnyx/webrtc`. Each operator has one telephony credential under the Credential Connection. Its name is `miot-op-` plus a hash of the organization and the operator. It is created on the first token. When the call ends, the CALL action gets:

| Field | Value |
| --- | --- |
| `durationSeconds` | seconds after the call was answered, 0 when not answered |
| `answered` | true when the call was answered |
| `details.telephony` | `provider`, `status: RECORDED`, `callId`, `hangupCause`, `sipCode`, `calleeNumber`, `startedAt` |

## Teams calls

The button opens `msteams:/l/call/0/0?users=4:+<E164>`. When no app opens, it opens the same path on `https://teams.microsoft.com`. The CALL action is saved with the timed duration and `details.telephony.status: PENDING`. The app calls `POST /reconcile` 2 and 10 minutes later.

The reconcile reads Graph `getPstnCalls` for the window of the operator's pending calls from the last 7 days. A record fills the action only when all of these match:

| Check | Rule |
| --- | --- |
| Operator | the record's `userPrincipalName` equals the operator's sign-in email, ignoring case |
| Callee | same digits as the number called |
| Time | the record started between 5 minutes before the call started and 5 minutes after it ended |
| Caller | the line's `defaultCallerId`, when set |

| Result | Action |
| --- | --- |
| One match | `durationSeconds` and `answered` (duration > 0) from the record; `status: RECORDED` |
| No match | stays `PENDING`; Graph publishes records late |
| More than one match | stays `PENDING` with `reason: AMBIGUOUS` |
| No match 48 hours after the call | `status: NOT_FOUND` |

A 404 or an empty list from Graph is treated as pending.

## Managed line: usage and billing

Billing uses only what Telnyx reports. The browser's report frees the channel and gives the call id.

| Step | What is stored in `miot_integrations` |
| --- | --- |
| Token issued | `telephony_operator_credentials`: the operator's SIP login and its organization. `telephony_usage`: a STARTED row, holding one channel. |
| Telnyx webhook `call.answered`, `call.hangup` | The row is found by `client_state` (the row id, base64) and confirmed with the seconds from the answer to the hangup. |
| Reconcile job, every 15 minutes | Detail records of the managed Credential Connection from the last 3 days. Each is charged to the organization that owns its `auth_username`, with `call_sec` (0 when not answered) and Telnyx's `cost`. |
| STARTED for 2 hours with no news | EXPIRED; it frees its channel and is not charged. |

Each call is rounded up to a whole minute. Only CONFIRMED rows are charged.

| Setting | Where |
| --- | --- |
| Webhook URL | `https://<modulith>/webhooks/telnyx/{connectionId}`, on the Telnyx Credential Connection |
| Webhook check | ed25519 signature of `telnyx-timestamp + "|" + body`, at most 5 minutes old |
| Job | `miot.integrations.telephony.reconcile.enabled` (true), `miot.integrations.telephony.reconcile.every` (15m) |
| Plan and minutes | Settings › Plataforma › Telefonía; `GET/PUT /api/v1/platform/telephony-plan` |
| Organization's month | `GET /api/v1/orgs/{organizationId}/telephony-usage` |

Prices are per billed minute: Chile mobile (`+56 9` and 8 digits), Chile landline (any other `+56`), other destinations, WhatsApp call. WhatsApp templates are priced each. A template is recorded when it is sent through the platform's WhatsApp account for an organization. A WhatsApp call is recorded from the `calls` webhook, once WhatsApp calling is on.

## Calls back to the shared number

An incoming call to the shared number belongs to the organization of the latest managed call to that caller in the last 24 hours, else to the platform's voicemail or notice. The webhook makes this decision and logs it (`InboundRouter`). Answering and transferring the call needs a Telnyx Call Control application. That is not built.
