# WhatsApp call permissions

Before a business number can call a contact over the WhatsApp Business Calling API, the contact must grant it permission. miot-conversational stores that permission and sends the request within Meta's limits.

Meta reference:

- User call permissions: https://developers.facebook.com/docs/whatsapp/cloud-api/calling/user-call-permissions
- Calling webhooks: https://developers.facebook.com/docs/whatsapp/cloud-api/calling/reference

## Permission model

Permissions are kept per business number (`phone_number_id`) and contact number, in `conv_call_permission`.

| Status | Meaning |
| --- | --- |
| `NONE` | The contact never answered a request. |
| `TEMPORARY` | Accepted. Expires at `expires_at`, 7 days after the reply unless Meta sends another time. |
| `PERMANENT` | Accepted with no expiry. |
| `DECLINED` | Rejected, with no earlier grant. |
| `REVOKED` | Rejected after a grant, or 4 unanswered business-initiated calls in a row. |

The app shows one of three states:

| State | When |
| --- | --- |
| Can call | `TEMPORARY` not expired, or `PERMANENT`. |
| Permission pending | A request was sent less than 7 days ago and has no reply yet. |
| No permission | Anything else. |

## Meta's limits

These limits apply per business number and contact. The service enforces them before sending, and returns a refusal instead of sending.

| Limit | Value |
| --- | --- |
| Requests per 24 hours | 1 |
| Requests per 7 days | 2 |
| Counter reset | A connected call, business- or user-initiated, resets both counters. |
| Temporary permission | 7 days |
| Unanswered calls | After 2 in a row the contact gets a reminder from Meta. After 4 the permission is revoked. |

Requests sent are stored in `conv_call_permission_request` and counted from there. Wamid-based uniqueness makes retry accounting idempotent. A rule job that already sent its message recovers the request record from that message's original business number and send time, without sending again. Manual admissions commit a request row with a null wamid **before** contacting Meta. A failed receipt write or an unknown send outcome (including a timeout) retains that slot across restarts, preventing an automatic duplicate; it counts against the normal 24-hour/7-day limits. A definitive client rejection (except an HTTP 408 timeout) or a pre-send connection-resolution failure releases it. Successful sends finalize the same row with their wamid. This uses the existing nullable wamid column and requires no new migration. Manual requests use the same outbound message pool, preserving the wamid and connection metadata needed to route shared-number replies and delivery callbacks.

Permission replies and terminal calls are journaled in `conv_call_permission_event`. A per-number/contact PostgreSQL transaction lock makes event insertion and permission replay atomic across workers. Calls are deduplicated by call id, replies by wamid; replay follows provider time, so delayed connected calls cannot erase newer misses and pre-grant misses cannot revoke a newer grant. A checkpoint preserves any permission predating this journal. Request admission and recording use the same lock. Manual reservations commit before the external send; queued rule sends hold their admission lock through the send and can recover accounting from the stored sent message. The final provider resolution checks the admitted tenant and business number. Permission updates without a valid provider timestamp are ignored rather than ordered by processing time. The journal is retained for deduplication and late-event replay; it is not pruned without a provider ordering/retention watermark.

## Sending a request

The request is the platform template `miot_call_permission_request` (see migration `V0.11.8`). In Meta, create a template with that name, a body, and a `call_permission_request` component. Its only named parameter is `nombre`. Generic message sends reject this template (also after a configured Meta-name change). A platform template save cannot remove its `callPermission` marker, and rule dispatch also recognizes its canonical key.

There are two ways to send it:

- **Rule:** Comunicaciones → Nueva regla → preset "Salida del viaje → solicitar permiso de llamada al conductor". It fires on `trip.milestone.confirmed` with `milestone == 'departure'` and writes to the contact whose `nationalId` equals the trip's `driver` after removing RUT formatting and uppercasing (the contact condition's `nationalId(...)` function). The rule is created off, as a draft. A refused request marks the queued message as failed with the reason.
- **Dialing step:** the WhatsApp row shows the state and a "Solicitar permiso" button. `POST /api/v1/orgs/{org}/conversations/whatsapp-call-permissions/requests` with `{"phone", "name"}`.

`GET /api/v1/orgs/{org}/conversations/whatsapp-call-permissions?phone=...` returns the state, `canRequest`, the refusal and `nextRequestAt`.

Refusals: `CALLING_DISABLED`, `INVALID_PHONE`, `NO_CONNECTION`, `NO_TEMPLATE`, `ALREADY_GRANTED`, `DAILY_LIMIT`, `WEEKLY_LIMIT`, `SEND_FAILED`.

## Webhook

The existing webhook `/webhooks/whatsapp/{connectionId}` handles:

| Event | Job | Effect |
| --- | --- | --- |
| `messages[]` with `interactive.type = call_permission_reply` | `whatsapp.inbound.call_permission` | Sets the status and expiry. The reply also appears in the conversation. |
| `calls[]` with `event = terminate` | `whatsapp.inbound.call` | A disconnected `COMPLETED` business call counts as unanswered; a disconnected `FAILED` attempt does not. A connected call clears the count and resets the request limits. |

Subscribe the Meta app to the `messages` and `calls` webhook fields.

## Configuration

| Property | Default | Purpose |
| --- | --- | --- |
| `miot.conversational.whatsapp-calling.enabled` (`MIOT_WHATSAPP_CALLING_ENABLED`) | `false` | Allows sending call permission requests. When off, nothing is sent and the app keeps opening `wa.me`. Replies and call events are stored either way. |

When calling is enabled, the mounted dialing step revalidates permission every 15 seconds and when focus returns, including after grants, revocations, and time-based expiry. Calling remains off by default. The permission service shares the conversational component build guard, so disabling that component does not require its template store.
