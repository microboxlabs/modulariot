# Totem fingerprint: legacy plugin and its replacement

The totem's fingerprint step calls a vendor browser plugin (`public/autentia/pluginautentiav3.js`)
that talks to a local Windows agent. This document describes what the plugin does, which of the
22 scripts the totem loads are needed, and the native replacement.

## What the plugin does

`validateRut` in `src/features/sovos-fingerprint/services/autentia.ts` calls `plgAutentiaJS.Transaccion2`.
That method does one thing: a single HTTPS POST to the local agent.

| Item | Value |
| --- | --- |
| URL | `https://plugin.autentia.mb:7777/json-handler/<token>` |
| Method, content type | `POST`, `text/plain; charset=ISO8859_1` |
| Body | `{ "paquete": [...], "hookAutentia": <bool>, "token": <number> }` |
| Response | `{ "ParamsGet": {...}, "token": "<echo>", "signature": "<hex>" }` |
| Transport | `jQuery.ajax`, no timeout |
| UI | `jQuery.blockUI` full-page overlay while waiting |

`paquete` for `Transaccion2(path, inputs, outputs, focus, token, cb)`:

```json
[
  { "comando": "ParamsInit", "param": "Rut,Erc,NroAudit,ErcDesc,oNombres,oSexo,oFchNac" },
  { "comando": "ParamsSet",  "param": [ { "idx": 1, "valor": "<rut>" } ] },
  { "comando": "Transaccion", "param": "<path>" },
  { "comando": "ParamsGet",  "param": 2, "paramName": "Erc" },
  { "comando": "ParamsGet",  "param": 3, "paramName": "NroAudit" }
]
```

One `ParamsGet` entry per requested output; `param` is the 1-based index in the `ParamsInit` list.

Response handling:

1. `ParamsGet.erc` (or `Erc`) equal to `0` means success.
2. On success the plugin verifies `signature` against an RSA-2048 public key embedded in the script
   (self-signed certificate, CN `Multibrowser JS`, expired 2016; only the key is used).
   The signed text is the raw response body with `"signature":"<hex>"` replaced by `"signature":""`.
   If that fails it retries with `"token":"<x>"` also replaced by `"token":""`.
3. A transport error yields `{ ParamsGet: { ercText: "Error de comunicacion con la componente Autentia." } }`.
4. If `window.jQuery` is missing at load time, the plugin injects jQuery 1.7.2 from `ajax.googleapis.com`.

## Scripts loaded today

`src/features/task-forms/components/sovos-deps/sovos-deps.tsx` loads these in order through `next/script`.

| Script | Used by the plugin for | Needed by a native client |
| --- | --- | --- |
| `jquery-2.1.4.min.js` | `ajax`, `blockUI` | No |
| `blockui.js` | Waiting overlay | No |
| `json2.js` | `JSON` polyfill | No |
| `yahoo-min.js` | `YAHOO.lang.extend` for old jsrsasign | No |
| `jsbn.js`, `jsbn2.js`, `rsa.js`, `rsa2.js` | RSA arithmetic | No (WebCrypto) |
| `base64.js`, `asn1hex-1.1.min.js`, `x509-1.1.min.js`, `rsapem-1.1.min.js`, `rsasign-1.2.min.js` | Parse the PEM certificate, verify the signature | No (WebCrypto) |
| `crypto-1.1.min.js`, `core.js`, `md5.js`, `sha1.js`, `sha256.js`, `sha512.js`, `ripemd160.js`, `x64-core.js` | Hash for the signature check | No (WebCrypto) |
| `pluginautentiav3.js` | The request and the checks above | No |

`ProcesoFirmaPDF`, `IniciarSesion`, `CerrarSesion` and the certificate-selection flows in the plugin
are not called by this app.

## Native client

`src/features/sovos-fingerprint/services/autentia-agent.ts` implements the same request with `fetch`
and verifies the signature with `crypto.subtle` (RSASSA-PKCS1-v1_5). It has no dependencies.

| Difference | Legacy plugin | Native client |
| --- | --- | --- |
| Timeout | None | `AbortController`, default 120 s |
| Page overlay | `blockUI` | None; the step renders its own state |
| Errors | Message string in `ercText` | `AutentiaError` with `code`, `erc`, `ercText` |
| Scripts | 22 files, ~430 KB | 0 |
| Token check | Silent when it fails | Rejects with `TOKEN_MISMATCH` |

Requirements on the kiosk are unchanged: the local agent installed, `plugin.autentia.mb` resolving
to it, and its certificate trusted by the browser.

### Rollout

| Step | Change | Exit condition |
| --- | --- | --- |
| 1 | Set `NEXT_PUBLIC_AUTENTIA_TRANSPORT=shadow`. The legacy plugin answers; the native client runs the same request afterwards and logs whether both agree. | Diagnostics show `agent.shadow` events with `match=true` on every kiosk, including the hash algorithm that verified. |
| 2 | Set `NEXT_PUBLIC_AUTENTIA_TRANSPORT=native`. | One week without `agent.*` errors that the legacy path did not also produce. |
| 3 | Delete `public/autentia/*` and `sovos-deps.tsx`. | — |

Until step 1 runs on a real kiosk, two facts are assumptions: the digest inside the signature is
SHA-256 (the client also tries SHA-1), and the agent accepts `application/json` bodies.
The shadow mode logs both.

## Diagnostics

Every totem step records events with `totemEvent` (`src/features/totem/diagnostics/totem-diagnostics.ts`).

| Where | What |
| --- | --- |
| Browser console | `[totem] <event> {...}` |
| `window.__totemDiagnostics` | Last 50 events, for on-device inspection |
| Server log | `POST /app/api/totem/diagnostics` → pino context `totem`, level `warn` for `*.error` and `*.failed` |

Events: `deps.loaded`, `deps.failed`, `fingerprint.start|ok|error`, `idcard.start|ok|error`,
`biometric.start|ok|error`. Fields: masked `rut`, `step`, `durationMs`, `code`, `status`, `erc`, `message`.

Server routes log with the same context and a `requestId`:

| Route | Log lines |
| --- | --- |
| `POST /app/api/task/validate-id-card` | `start`, one per step (`CAP_LOGIN`, `CAP_CONTENT`, `CAP_SIGN`), `ok` or `failed at <step>` |
| `POST /app/api/biometric/verify` | `ok` or `failed` |

Filter production logs with `context=totem`. Match a browser event to its server line by the masked
RUT and the timestamp.

| Variable | Default | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_AUTENTIA_TIMEOUT_MS` | `120000` | Fingerprint transaction timeout |
| `CAP_API_TIMEOUT_MS` | `15000` | Timeout per call to the signing provider |
