# WhatsApp Business calling

Design and skeleton. Off by default: `miot.conversational.whatsapp.calling.enabled=false`. With the flag off, nothing here sends a request or reads a webhook. There is no media path: no SDP is produced, and no call audio reaches a browser.

Calling uses the organization's existing WHATSAPP connection: its base URL, `phone_number_id` and token. No new connection type.

## Code

| Class | What it does |
| --- | --- |
| `WhatsAppCallingSettings` | Reads the flag. `requireEnabled()` throws while it is off. |
| `CallPermissionPolicy` | Decides whether the business can call, ask for permission, or must wait. |
| `WhatsAppCallingRequests` | Builds the request bodies below. Sends nothing. |
| `WhatsAppCallEvents` | Parses `calls` webhook events and permission replies. |

All are in `com.microboxlabs.miot.conversational.calling`.

## Requests

Paths are relative to the connection's base URL.

| Step | Request | Body |
| --- | --- | --- |
| Enable calling on the number | `POST /{phone-number-id}/settings` | `{"calling":{"status":"ENABLED","call_icon_visibility":"DEFAULT","callback_permission_status":"ENABLED"}}` |
| Ask the user for permission | `POST /{phone-number-id}/messages` | interactive `call_permission_request` |
| Place a call | `POST /{phone-number-id}/calls` | `{"messaging_product":"whatsapp","to":"…","action":"connect","session":{"sdp_type":"offer","sdp":"…"}}` |
| End a call | `POST /{phone-number-id}/calls` | `{"messaging_product":"whatsapp","call_id":"…","action":"terminate"}` |

In the Meta app, subscribe the webhook to the `calls` field in addition to `messages`.

## Permission model

A business-initiated call needs the user's permission. The business asks with a `call_permission_request` message. The user answers in a `messages` webhook of type `interactive.call_permission_reply`: `accept` or `reject`, plus `is_permanent` and `expiration_timestamp`.

| Rule | Value |
| --- | --- |
| Permission requests per user | 1 in 24 hours, 2 in 7 days |
| Temporary permission | valid until `expiration_timestamp` |
| Permanent permission | valid until the user revokes it |

`CallPermissionPolicy.decide(requests, grant, now)` returns:

| Decision | When |
| --- | --- |
| `CALL` | An accepted permission has not expired. |
| `REQUEST_PERMISSION` | No valid permission, and both limits allow a request. |
| `WAIT` | A limit is reached. `nextRequestAt` says when a request is allowed again. |

Confirm the current limits in Meta's Calling API documentation before turning the flag on. Meta also limits calls per user per day once permission is granted.

## Call events

`calls[]` in `entry[].changes[].value` (field `calls`):

| Event | Fields read |
| --- | --- |
| `connect` | `id`, `from`, `to`, `timestamp`, `session.sdp_type` (`answer`), `session.sdp` |
| `terminate` | `id`, `status`, `duration` (seconds), `timestamp` |

## Next steps

1. Store permission requests and replies per WhatsApp contact (a table in `miot_conversational`), and feed them to `CallPermissionPolicy`.
2. Wire `WhatsAppCallEvents` into `WhatsAppWebhookResource` behind the flag.
3. Send the requests through the WHATSAPP connection, as `WhatsAppMessagingService` does.
4. Media: the browser creates the SDP offer with `RTCPeerConnection` and applies the SDP answer from the `connect` event. The modulith relays SDP and never handles audio.
5. Record the call as a CALL action with method `WHATSAPP`, using the duration from `terminate`.
