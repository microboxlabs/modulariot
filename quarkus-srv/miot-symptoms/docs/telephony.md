# Telephony for "Llamar a"

The Control Tower places calls through the organization's telephony connection. A connection is created in Conexiones. Its secret is kept in a credential.

| Provider type | Credential | Connection metadata |
| --- | --- | --- |
| `TELNYX` | Telnyx (bearer token, the API key) | `sipConnectionId` (a Credential Connection for WebRTC), `callerNumber` (E.164) |
| `TEAMS_PHONE` | Microsoft Entra app, scope `https://graph.microsoft.com/.default`, application permission CallRecords.Read.All | `defaultCallerId` (E.164, optional) |

For Telnyx, use a Credential Connection made for WebRTC. A Teams Operator Connect connection does not work.

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
