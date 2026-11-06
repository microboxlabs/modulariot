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

Billing uses what Telnyx reports. The browser's report only frees the channel; its supplied call id is ignored. Verified webhooks and detail records bind provider ids, destinations and charges. Writers serialize per connection, and a detail record remains authoritative over later webhooks.

| Step | What is stored in `miot_integrations` |
| --- | --- |
| Token issued | `telephony_operator_credentials`: the operator's SIP login and its organization. `telephony_usage`: a STARTED row, holding one channel. |
| Telnyx webhook `call.answered`, `call.hangup` | The private PSTN-leg `client_state` resolves the admission binding to its ledger row; seconds run from answer to hangup. |
| Reconcile job, every 15 minutes | Detail records of the managed Credential Connection from the last 3 days. Each is charged to the organization that owns its `auth_username`, with `call_sec` (0 when not answered) and Telnyx's `cost`. |
| STARTED or ENDED for 2 hours with no provider confirmation | EXPIRED; it frees its channel and is not charged. |

Each call is rounded up to a whole minute. Only CONFIRMED rows are charged.

### Per-call admission and resumable reconciliation

The WebRTC JWT remains a reusable 24-hour login, but its Credential Connection must park outbound calls. Set `MIOT_INTEGRATIONS_TELEPHONY_WEBHOOK_BASE_URL` to the public HTTPS modulith origin. Before issuing any JWT the server verifies that the provider connection is active, has `outbound.call_parking_enabled: true`, uses webhook API version `2` at exactly `<origin>/webhooks/telnyx/{connectionId}`, and disables inbound SIP URI calling with `sip_uri_calling_preference: disabled`. A missing or different configuration refuses the token.

**Admission remains blocked for production certification:** [Telnyx documents that emergency calls bypass parking](https://support.telnyx.com/en/articles/4351104-sip-connection-settings). Parking therefore protects ordinary PSTN calls but does not establish admission for every route available to this reusable JWT. A verified provider restriction covering those routes, or a different authentication/calling architecture, is still required. These changes have not been exercised against a real Telnyx account.

On the signed parked-leg webhook the server consumes one unused reservation, rechecks quota and the line's current channel limit, and transfers the leg to the reservation's stored destination using its API key. Reservations must be consumed within five minutes. A second SDK call cannot reuse one. The transfer has a stable command ID for retries and a private target-leg state, never returned to the browser, so only the PSTN leg supplies billable answer/hangup events. A browser end report cannot release an admitted channel; provider events or the bounded provider call duration release it.

The fallback detail-record scan visits at most 20 pages per run and persists its next page in PostgreSQL. Restarts and other replicas continue that cursor under a shared lock. Pages use descending `started_at`, so new records enter before the cursor and may cause safe duplicate processing rather than skipping unvisited records. The lookback expands by the elapsed scan duration rounded up to days, retaining the original window with either rolling or calendar-day provider semantics. HTTP failures and malformed pagination retain the failed page. Incomplete results and logs include `nextPage`. A completed scan clears the cursor and starts a fresh three-day pass next time to revisit late records and costs.

Migration `V0.6.41` adds the admission bindings and reconciliation cursor. Previously applied migrations remain unchanged. Before enabling production calling, configure parking and the signed webhook on Telnyx, set the public origin above, and test an allowed call, a second SDK call with the same JWT, quota/channel refusal, hangup, and CDR reconciliation against the actual provider.

Provider contracts: [parked credential connections](https://developers.telnyx.com/docs/voice/webrtc/auth/credential-connections), [server-side transfer](https://developers.telnyx.com/api-reference/call-commands/transfer-call), [detail record pagination](https://developers.telnyx.com/api-reference/detail-records/search-detail-records).

| Setting | Where |
| --- | --- |
| Webhook URL | `https://<modulith>/webhooks/telnyx/{connectionId}`, on the Telnyx Credential Connection |
| Webhook check | ed25519 signature of `telnyx-timestamp + "|" + body`, at most 5 minutes old |
| Job | `miot.integrations.telephony.reconcile.enabled` (true), `miot.integrations.telephony.reconcile.every` (15m) |
| Plan and minutes | Settings › Plataforma › Telefonía; `GET/PUT /api/v1/platform/telephony-plan` |
| Organization's month | `GET /api/v1/orgs/{organizationId}/telephony-usage` |

Prices are per billed minute: Chile mobile (`+56 9` and 8 digits), Chile landline (any other `+56`), other destinations, WhatsApp call. WhatsApp templates are priced each. A template is recorded when it is sent through the platform's WhatsApp account for an organization. A WhatsApp call is recorded from its Telnyx WhatsApp leg (see [WhatsApp calls](#whatsapp-calls)).

## Calls back to the shared number

An incoming call to the shared number belongs to the organization of the latest managed call to that caller in the last 24 hours, else to the platform's voicemail or notice. The webhook makes this decision and logs it (`InboundRouter`). Answering and transferring the call needs a Telnyx Call Control application. That is not built.

## WhatsApp calls

The business number has WhatsApp voice calls and SIP on at Meta, pointed at the SIP subdomain of a Telnyx Call Control application. All WhatsApp calls are SIP between Meta and Telnyx; Meta's calling webhooks are not used. The application's webhook is the managed line's: `https://<modulith>/webhooks/telnyx/{connectionId}`.

Only the managed line reaches WhatsApp: the WhatsApp application is in the platform's Telnyx account. An organization with its own TELNYX line keeps the wa.me chat.

### Configuration

WhatsApp calling is off while any required key is missing. The WhatsApp button then opens the chat.

| Key | Required | Value |
| --- | --- | --- |
| `miot.integrations.whatsapp-calling.connection-id` | yes | id of the WhatsApp Call Control application, e.g. `<call-control-app-id>` |
| `miot.integrations.whatsapp-calling.sip-host` | yes | Meta's SIP host for the business number, e.g. `<meta-sip-host>` |
| `miot.integrations.whatsapp-calling.business-number` | yes | the business number, E.164, e.g. `+<business-digits>` |
| `miot.integrations.whatsapp-calling.sip-username` | yes | Meta's SIP user: the business digits without `+` |
| `miot.integrations.whatsapp-calling.sip-password` | yes, secret | Meta's SIP user password; set it from a secret |
| `miot.integrations.whatsapp-calling.media-encryption` | yes | `DTLS`, or `SRTP` when the number uses SDES |
| `miot.integrations.whatsapp-calling.ring-timeout` | no (`45s`) | how long a contact's call rings in the tower |
| `miot.integrations.whatsapp-calling.unanswered-message` | no | text spoken to a caller nobody answers |
| `miot.integrations.whatsapp-calling.ring-check` | no (`5s`) | how often ringing calls are checked for the timeout |

As environment variables: `MIOT_INTEGRATIONS_WHATSAPP_CALLING_CONNECTION_ID`, and so on.

### Operator calls a contact

1. The app asks `POST /webrtc-token {calleeNumber, caseRef, channel: "WHATSAPP"}`. The server refuses with 409 `whatsapp_no_permission` when the contact has not allowed calls, and `whatsapp_calling_unavailable` when WhatsApp calling is off for the line. A `WHATSAPP_CALL` row reserves a channel.
2. The browser dials as for a PSTN call. Its leg is parked and admitted (see above).
3. On admission the server sends `POST /v2/calls` on the WhatsApp application: `to` `sip:+<contact digits>@wa.meta.vc:5061;transport=tls`, `from` `sip:+<business digits>@<sip-host>`, SIP auth, TLS, the media encryption, OPUS, `link_to` the parked leg.
4. When WhatsApp answers, the server bridges the parked leg and the WhatsApp leg.
5. When either leg hangs up, the server hangs up the other. The WhatsApp leg's answer and hangup confirm the row.

A SIP 403 ("No Approved Call Permission Found") is kept for the row. The app reads it with `GET /calls/{callRef}` (`{failure: "whatsapp_no_permission"}`) and shows "el conductor no ha aceptado las llamadas".

The app checks the permission with `GET /api/v1/orgs/{organizationId}/conversations/whatsapp-call-permissions?phone=` before calling. Without permission the button is disabled and the permission row offers the request.

### Contact calls the tower

1. `call.initiated`, direction incoming, on the WhatsApp application: the server reads the caller from `from`.
2. The caller's organization is the one organization whose contact book has an active contact with that phone or WhatsApp number (trip drivers are synced into the book). Else the organization of the latest managed call to that number in 24 hours. The case is the latest open treatment with a call to that contact.
3. A known caller's call rings (it is not answered) and is listed in `GET /whatsapp-calls` for the organization's operators. The app shows it with "Contestar".
4. "Contestar" asks `POST /whatsapp-calls/{id}/answer`, a login with a reservation. 409 `whatsapp_call_taken` when another operator took it or it ended. The browser dials; on admission the server answers the WhatsApp leg and bridges it to the operator's leg.
5. An unknown caller, or a call nobody takes within `ring-timeout`, is answered, hears `unanswered-message`, and is hung up.

| Endpoint (under `/control-tower/telephony`) | Permission | Result |
| --- | --- | --- |
| `GET /calls/{callRef}` | `controltower:case.treat` | `{failure}`: why the provider ended the call before it connected, or null |
| `GET /whatsapp-calls` | `controltower:case.treat` | ringing calls: `id`, `callerNumber`, `callerName`, `caseRef`, `since` |
| `POST /whatsapp-calls/{id}/answer` | `controltower:case.treat` | `{token, callerNumber, expiresAt, callRef}` |

`GET /telephony` answers `whatsAppCalling: true` when the active line is the managed one and the configuration is complete.

### Metering

WhatsApp calls are `WHATSAPP_CALL` rows in `telephony_usage`, confirmed by the WhatsApp leg's webhook, rounded up to a whole minute.

| Destination type | Price |
| --- | --- |
| `WHATSAPP_CALL` (operator calls) | the plan's WhatsApp call price per minute |
| `WHATSAPP_INBOUND` (contact calls) | 0: free on Meta's side; minutes are shown |

WhatsApp minutes do not count against the voice quota. The detail-record reconcile skips the operator's parked leg of a WhatsApp call.

Migration `V0.6.42` adds `telephony_whatsapp_legs` (the WhatsApp leg and Meta's refusal per row) and `whatsapp_inbound_calls`.
