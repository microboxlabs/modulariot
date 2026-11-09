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

The button opens `msteams:/l/call/0/0?users=4:+<E164>`. When no app opens, it opens the same path on `https://teams.microsoft.com`. The CALL action is saved with the timed duration and `details.telephony.status: PENDING`.

The reconcile runs:

- when the app calls `POST /reconcile`, 2 and 10 minutes after the call is saved;
- every 5 minutes on the server, for each operator with pending Teams calls in an organization with a ready Teams Phone line.

It reads both Graph call reports for the window of the operator's pending calls from the last 7 days:

| Report | Graph function | Outbound call types |
| --- | --- | --- |
| PSTN (Calling Plans, Operator Connect) | `getPstnCalls` | ending in `_out`, e.g. `user_out` |
| Direct Routing | `getDirectRoutingCalls` | starting with `ByotOut` (`ByotOut`, `ByotOutUserForwarding`, ...) or `dr_out` |

A record fills the action only when all of these match:

| Check | Rule |
| --- | --- |
| Direction | an outbound call type of its report |
| Operator | the record's `userPrincipalName` equals the operator's sign-in email, ignoring case |
| Callee | same digits as the number called |
| Time | the record started between 5 minutes before the call started and 5 minutes after it ended |
| Caller | the line's `defaultCallerId`, when set |

| Result | Action |
| --- | --- |
| One match | `durationSeconds` and `answered` from the record; `status: RECORDED`, `report: PSTN` or `DIRECT_ROUTING` |
| No match | stays `PENDING`; Graph publishes records late |
| More than one match | stays `PENDING` with `reason: AMBIGUOUS` |
| No match 48 hours after the call | `status: NOT_FOUND` |

A record is assigned to one action only.

The scheduled run shares one complete Graph lookup per organization across its pending operators. A failed lookup
is not retried for each operator. Each run considers at most 500 callers; Graph requests, including both reports
and their pages, are serialized and paced at no more than four per second per replica. Each report has a five-page
limit and an incomplete scan fails without assigning records. The advisory lock covers the entire scheduled run.

| Field | PSTN row | Direct Routing row |
| --- | --- | --- |
| `recordId` | `id` | `id` |
| `callId` | `callId` | `correlationId` |
| `durationSeconds` | `duration` | `endDateTime` − `startDateTime` when `successfulCall`; 0 when not. Its `duration` counts from the invite, ringing included. |
| `answered` | `duration` > 0 | `successfulCall` |

A 404 or an empty list from Graph is treated as pending. Any other error from either report fails the reconcile, and the actions stay pending.

The connection test reads both reports for the last hour and says how many calls each returned, e.g. `PSTN: 0, Direct Routing: 3`. A count with `+` has more pages.

| Variable | Default | Purpose |
| --- | --- | --- |
| `MIOT_SYMPTOMS_TEAMS_RECONCILE_ENABLED` | the symptoms component switch | Turns the server reconcile on or off. |
| `MIOT_SYMPTOMS_TEAMS_RECONCILE_EVERY` | `5m` | How often it runs. One replica runs it at a time. |

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

Prices are per billed minute: Chile mobile (`+56 9` and 8 digits), Chile landline (any other `+56`), other destinations, WhatsApp call. WhatsApp templates are priced each. A template is recorded when it is sent through the platform's WhatsApp account for an organization. A WhatsApp call is recorded from the `calls` webhook, once WhatsApp calling is on.

## Calls back to the shared number

An incoming call to the shared number belongs to the organization of the latest managed call to that caller in the last 24 hours, else to the platform's voicemail or notice. The webhook makes this decision and logs it (`InboundRouter`). Answering and transferring the call needs a Telnyx Call Control application. That is not built.
