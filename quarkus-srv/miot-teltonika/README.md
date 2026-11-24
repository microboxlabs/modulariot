# miot-teltonika

GPS devices that organizations connect **directly** to the platform, without a GPS provider platform in between. Native: Teltonika Codec 8 / 8 Extended over TCP, UDP and MQTT (FMB9xx, FMB1xx, FMC1xx). Other brands (Concox, Queclink, Coban, Sinotrack, Meitrack, Ruptela, Suntech, CalAmp, OsmAnd) through a Traccar gateway the platform runs.

The platform does not sell devices: the organization or its installer points its own devices to the receiver, registers them by IMEI, proves possession with an activation code and checks the installation from the API.

It runs in its **own deployment**: `miot.component.teltonika.enabled` is not part of `miot.component.all.enabled`. Its readiness is the health group `/q/health/group/teltonika`; the component check in the pod-wide health stays UP and reports the receiver state as data. Outside dev it refuses to start without Pulsar and a topic (`require-broker`).

```
Teltonika ──TCP / UDP :5027──┐
Teltonika ──MQTT (TLS)──► broker ──► subscriber ──┤
other brands ──► Traccar ──JSON──► /internal/gps/traccar/positions ──┤
                                                  ▼
device ──TCP :5027──► miot-teltonika ──► Pulsar asset-positions topic (distributed mode)
   ▲                     │          └──► in-process tracking channel (standalone mode)
   │ Codec 12            ├── registry (miot_teltonika.device / device_assignment)
   └─────────────────────┤── health (device_status) and kept packets (packet_log)
                         └── commands and intensive tracking (device_command, intensive_tracking)
```

Each record is published as the same `EnvelopedMessage` that `POST /api/v1/asset/track` produces, with the **organization's GPS client id** (the one in Ajustes › Integración GPS) and the **asset assigned at the record's time**.

Protocol: [Teltonika Data Sending Protocols](https://wiki.teltonika-gps.com/view/Teltonika_Data_Sending_Protocols). AVL IDs: [FMB920 Data Sending Parameters ID](https://wiki.teltonika-gps.com/view/FMB920_Teltonika_Data_Sending_Parameters_ID). Parameters: [FMB920 Parameter list](https://wiki.teltonika-gps.com/view/FMB920_Parameter_list).

## Registration and possession

1. `POST /gps/devices` with the IMEI (15 digits, Luhn check digit) and the plate. The plate is refused if another organization receives data for it (`miot_tracking.asset_client_map`).
2. The device starts **pending**, with a 6-digit activation code and a claim that expires in `claim-ttl` (72 h). The connection guide puts the code first: `setparam 2015:<code>`.
3. A pending device may connect: its packets are written to the packet log and acknowledged, not published. The receiver asks it `getparam 2015`; when the answer matches, the device is activated and the kept packets are published (the data of the day of the installation is not lost).
4. An IMEI another organization holds, or claimed and has not let expire, is answered 404 "not available" (no existence leak); the same organization gets 409.
5. The first assignment starts `assignment-backfill` (7 days) before the registration, so records the device buffered while it was refused keep their plate.
6. Registration is one transaction (device + assignment). Reassigning restarts the installation sightings (ignition, iButton).

## Session

1. The device must send its IMEI within `handshake-timeout` (10 s). Registered and active (or pending): `01`. Otherwise `00` and close. A second connection with the same IMEI replaces the first (counted and logged with both addresses).
2. For each AVL packet:
   - **Bad CRC:** no answer; the device sends it again. Kept in the packet log.
   - **Valid CRC, not decodable** (unsupported codec, inconsistent counts): **quarantined**, written to the packet log and only then acknowledged with the count the device declared, so it cannot block the device's queue.
   - **Decoded:** the packet waits its turn (first come, first served) for room among `max-in-flight-records`, records are published off the event loop, records that cannot be published are written to the packet log, and only then the count is answered. If the write fails, or the publish deadline (`publish-timeout`, 20 s from reception, waiting included; below the device's 30 s) passes, the connection closes without answer and the device resends.
3. **Nothing is acknowledged unless it was published or durably written.** Records not published: no position (0/0), time outside `max-future-skew` / `max-record-age` (device clock wrong), no asset assigned at that time. Records sent again are acknowledged but not published twice (per-device window, idle devices evicted; the request id is deterministic for a database-level guard).
4. **Codec 12:** a pending command is claimed in the database before it is written to the socket (no two instances send it); a busy session releases it for the next round. No answer within `command-timeout` fails the command.
5. **Shutdown:** refuses new connections, stops reading, waits up to `shutdown-grace` for packets in progress, then closes sessions and listeners.

The listener runs as `instances` verticles (default: one per processor) sharing the port, each on its own event loop. Components start before the modulith migrates its schemas: the receiver loads the registry in the background and opens the port only after that, so no device is refused for a registry not loaded yet. Periodic housekeeping (command expiry, intensive end and restore retries, packet-log retention) runs in one instance at a time (advisory lock).

## Mapping

`AvlRecordMapper` turns each record into `AssetTrackingData`:

| AVL ID | Field |
|---|---|
| GPS element | `gps`. Without a current fix the last known position is kept (FMB behaviour, `publish-last-known-position`); `gnss_status` tells which. 0/0: no `gps`, record not published |
| 239 Ignition | `sensors.engine_status` (boolean) |
| 16 / 199 Odometer (m) | `sensors.odometer.total_distance` / `trip_distance` (km) and metric `vehicle.odometer` |
| 17–19 Axis X/Y/Z (mG) | `sensors.acceleration` (g) |
| 78 iButton | `driver_info.id_button`, 16 uppercase hex digits; not sent when 0 |
| 205, 206, 241 | `telecom.cell_id`, `lac`, `operator` / `mcc` / `mnc` |
| 66 External voltage (mV) | metric `battery.voltage` (V) |
| 253/254 Green driving | event `hard_accel`, `hard_brake` (g force) or `hard_turn` |
| 255 Over speeding | event `speeding`, only on the record that starts the episode |
| 247 Crash detection | event `impact`, only for a real crash (value 1); partial traces stay as data |
| 252, 249, 246 | events `power_unplugged`, `gps_jamming`, `towing` (on the start value) |
| everything else | one extension metric `x.teltonika.io` with named values (`gsm_signal`, `din1`, `hdop`, `gnss_status`, `sleep_mode`, `dallas_temp_1_c`…) and `io_<id>` for unnamed IDs |

`telecom.signal_strength` is dBm in the model, so the device's 0–5 scale goes to `x.teltonika.io.gsm_signal`. Dallas temperatures (72–75) are signed. One extension metric per record because tracking keeps one per asset and instant.

To confirm on a real device: the iButton byte order against the code printed on the key, the ICCID format (IDs 11 and 14 kept raw), and the start/end pairing of over speeding.

## API

`/api/v1/orgs/{organizationId}/gps/devices` — permissions in `DevicesAccessCatalog` (module `gps-devices`: Lector, Mantenedor, Operador; Admin and Owner hold all).

| Method | Path | Permission | |
|---|---|---|---|
| GET | `/` | view | Devices with current asset and last contact (`?active=`) |
| POST | `/` | write | Register: `imei`, `model`, `label`, `assetId`, `assignedFrom` |
| GET / PUT / DELETE | `/{imei}` | view / write / write | Detail with every assignment; edit model/label; deactivate |
| POST | `/{imei}/assignments` | write | Reassign: `assetId`, `from` (records keep the asset of their time) |
| GET | `/{imei}/connection` | view | Server, port, parameters and `setparam` commands (GPRS and SMS ≤ 160 chars) |
| GET | `/{imei}/health` | view | Last contact, last values, error counters |
| GET | `/{imei}/installation-check` | view | Reports, GPS fix, ignition on/off, power (required); signal, iButton, frequency, errors, sleep |
| GET | `/{imei}/packets` | view | Kept packets in hex with outcome and reason |
| POST | `/{imei}/capture` | write | Keep every packet for `minutes` (≤ 120) |
| GET / POST | `/{imei}/commands` | view / command | List; queue `getinfo`, `getver`, `getgps`, `getio`, `getstatus`, `getparam` of non-secret IDs, or `setparam` of frequency IDs within safe ranges (e.g. 10050 between 5 and 600 s) |
| POST / DELETE | `/{imei}/intensive-tracking` | command | Reads the device's own frequency (`getparam`), raises it for `minutes` (≤ 12 h), then restores those values; the restore is retried for up to 30 days until the device confirms `New value` |

Nothing that acts on the vehicle (digital outputs) is offered.

## Configuration

| Property | Default | |
|---|---|---|
| `miot.component.teltonika.enabled` | master switch | Build and runtime switch, like every component |
| `miot.teltonika.host` / `port` | `0.0.0.0` / `5027` | Listener |
| `miot.teltonika.public-host` / `public-port` | `devices.modulariot.com` / `5027` | What the connection guide tells the installer |
| `miot.teltonika.idle-timeout` | `600s` | Longer than the device's open link timeout (300 s) |
| `miot.teltonika.handshake-timeout` | `10s` | |
| `miot.teltonika.max-connections-per-ip` | `50` | APN NAT may put several devices behind one address |
| `miot.teltonika.accept-backlog` | `8192` | Reconnection storms after an outage (capped by the OS `somaxconn`) |
| `miot.teltonika.instances` | `0` (one per processor) | Listener event loops |
| `miot.teltonika.require-broker` | `true` (`false` in dev) | Refuse to start with the log publisher or without a topic |
| `miot.teltonika.activation-required` / `claim-ttl` / `assignment-backfill` | `true` / `72h` / `7d` | Possession proof and first assignment |
| `miot.teltonika.topic` | `miot.tracking.pulsar.topic` | |
| `miot.teltonika.publish-timeout` / `max-in-flight-records` | `20s` / `2000` | |
| `miot.teltonika.max-future-skew` / `max-record-age` | `5m` / `30d` | Accepted record times |
| `miot.teltonika.duplicate-window` / `duplicate-idle-eviction` | `256` / `2h` | ~90 MB for 5,000 devices |
| `miot.teltonika.registry-refresh` / `monitor-flush` / `command-poll` | `10s` / `5s` / `2s` | A change made on another pod reaches this one within the refresh |
| `miot.teltonika.packet-queue-size` / `packet-retention` | `10000` / `7d` | Packet log partitioned by day (pg_partman); only captures and command answers go through the queue |
| `miot.teltonika.command-timeout` / `shutdown-grace` | `30s` / `15s` | |
| `miot.teltonika.tls-cert-path` / `tls-key-path` | — | PEM; TLS on when set (device parameter 2020) |
| `miot.teltonika.gps-provider` / `publish-last-known-position` / `log-raw-packets` | `Teltonika` / `true` / `false` | |
| `miot.teltonika.bootstrap-devices."<imei>"` | — | `<tenant>/<asset>`, registered at startup when missing (dev profile only) |

Metrics at `/q/metrics`, prefix `miot_teltonika_`: connections, accepted/rejected devices, handshake timeouts, IP-limited and replaced sessions, packets, CRC errors, protocol errors, quarantined packets, records published / not published / duplicates, publish failures and latency, record lag (reception − record time), commands sent/answered, records in flight, registry size, packet-log drops.

## Local development

```bash
# Unit and TCP tests (wiki packets, Codec 12, mapping, services, API, real sessions)
./mvnw -pl miot-teltonika test

# Plus the stores on real PostgreSQL, in a scratch schema (never a shared database)
./mvnw -pl miot-teltonika test -Dmiot.teltonika.test.pg-url=postgresql://miot:miot@127.0.0.1:55432/miot_dev

# Receiver inside the modulith: needs the modulith database (dev profile bootstraps two activated devices)
./start.sh teltonika
# Readiness of the receiver
curl localhost:8180/q/health/group/teltonika
```

The full chain (PostgreSQL with postgis + pg_partman, Pulsar, tracking) runs from `iniciativas/ingesta-directa-teltonika/dev/` in the modularsql workspace: `docker compose up -d`, `./init-pulsar.sh`, `./start-modulith.sh`, `./run-e2e.sh`.

FMB920 emulator (`./mvnw -pl miot-teltonika test-compile` first):

```bash
java -cp "miot-teltonika/target/test-classes:miot-teltonika/target/classes" \
  com.microboxlabs.miot.teltonika.tools.Fmb920Emulator --scenario route
```

| Scenario | What it does |
|---|---|
| `wiki` | The three TCP examples of the Teltonika wiki (2019, position 0/0: acknowledged, kept, not published) |
| `route` | 20-record trip in Santiago in packets of 5, sent in 37-byte pieces: ignition on/off, iButton, harsh braking; then a bad CRC |
| `outage` | A packet, drop before the ack, reconnect and resend |
| `anomalies` | Records dated next year and a Codec 16 packet with valid CRC, then a normal one |
| `commands` | One packet, then answers every Codec 12 command for `--seconds`; `--code` sets parameter 2015 (activation) |
| `load` | `--devices` connections (valid IMEIs `35000000nnnnnn` + Luhn) sending one record every 30 s for `--seconds`, reconnecting like a device |

Measured locally (MacBook, modulith + Pulsar + PostgreSQL in Colima, 14 event loops): 5,000 simultaneous devices, 14,935 records acknowledged = 14,935 persisted, no duplicates, ack latency 3 ms average / 172 ms max, application RSS ~870 MB. macOS caps the accept queue at 128 (`kern.ipc.somaxconn`): connection retries are the local OS, not the receiver. Not measured: hours-long runs, TLS, Pulsar or database slow/down, several pods behind a load balancer, cellular NAT.

## Channels and brands

Every channel ends in the same sink with the same rules (tenant code, time window, asset by time, duplicates, input profile) and the same "acknowledged only when published or durably kept" guarantee. What changes is the transport and the acknowledgment:

| Channel | Who | Acknowledgment | Commands | Possession |
|---|---|---|---|---|
| TCP `:5027` | Teltonika, protocol 0 | 4-byte record count | Codec 12 on the session | activation code (2015) |
| UDP `:5027` (`udp-port`) | Teltonika, protocol 1 | `0005 packetId 01 avlId count` per datagram | none | activation code |
| MQTT (`mqtt.*`) | Teltonika, protocol MQTT, client "AWS IoT Custom", Codec JSON or 8/8E | PUBACK after publishing; on failure the receiver reconnects and the broker resends | `{"CMD":"..."}` on `<IMEI>/commands`, answer on the data topic | activation code |
| Traccar (`traccar-key`) | other brands, 200+ protocols | HTTP 200 (or 503: Traccar retries) | none | platform approval |

- **Model catalog** (`device_model`): code, brand, protocol, `native` or `traccar`, Traccar port, verified. Registration validates the model and the identifier (Teltonika: 15-digit IMEI with Luhn; others: what the device sends, 4–32 letters and digits). `GET .../gps/devices/models`.
- **MQTT**: the broker authenticates devices with a client certificate whose CN is the IMEI and an ACL (`pattern write %u/data`, `pattern read %u/commands`), so a device cannot publish as another. The receiver subscribes with QoS 1, a persistent session and a shared subscription (`$share/miot-teltonika/+/data`). Each replica has its own client id (`client-id`, default `miot-teltonika-receiver-{host}`, `{host}` = the pod's host name); run it as a StatefulSet so the name and the broker session survive a restart. A message that cannot be decoded is quarantined and acknowledged; a failed publish closes only the connection it arrived on, so the broker resends it. Teltonika requires TLS. Codec JSON accepts `latlng` (devices) and `lnglat` (wiki).
- **Traccar**: forwards every position as JSON (`forward.type=json`) with header `x-miot-traccar-key`; the endpoint is under `/internal` with a permit policy and checks the key itself (503 without key configured). Unknown devices answer 200 so Traccar does not retry them; while the receiver is not ready (registry not loaded, or the component off in that pod) the endpoint answers 503, so nothing is dropped for a registry not loaded yet. Pending devices keep their positions as JSON in `packet_log` (`format=traccar_json`); `POST /api/v1/platform/gps/devices/{id}/approve` (platform owners) activates and replays them.
- **One channel per model** (`ChannelRules`): the native receivers (TCP, UDP, MQTT) only hear devices of native models, and Traccar only devices of Traccar models with the model's protocol (`wrong_channel` otherwise). An IMEI cannot be fed through a channel that does not prove possession.
- **Replay after activation** marks only the packets it published (by row id); what is still pending for an active device (a replay that failed, or packets another pod kept meanwhile) is replayed every minute by one instance.
- **Input profiles** (`input_profile`, `input_mapping`): what is wired to `din1..din4` / `ain1..ain2` (door, panic, PTO, refrigeration, seatbelt, tamper, custom), active level or threshold in volts, events on/off. Teltonika I/O 1–4, 9, 10 and Traccar `in1..in4`, `input` bitmask, `adc1/adc2` map to the same names. Events (`door_open`, `panic_button`...) on state change per device; the state (and the over-speeding episode) moves only when the records are published, so a packet sent again after a failed publish produces the same events; named states travel in the extension metric under `inputs`. The first state after a restart produces no event unless the device says that input generated the record.
- **Configuration profiles** (`config_profile`): Teltonika parameters per organization (frequency within the command ranges, 101 ignition source, 102 sleep, 104/105, I/O element settings 50000–59999). Never server, APN or keys. Shown in the connection guide, sent to the device with `POST .../{imei}/profiles/apply` (setparam in chunks of ≤480 characters), and used by intensive tracking to restore a value it could not read.
- Packets are kept with their `format` (`teltonika_tcp`, `teltonika_udp`, `teltonika_mqtt`, `traccar_json`) so a replay decodes each one its own way.

Configuration: `miot.teltonika.udp-port`, `traccar-key`, `traccar-public-host`, `mqtt.enabled|host|port|tls|ca-path|cert-path|key-path|client-id|username|password|data-topic-filter|command-topic|reconnect-delay|link-idle`. All off by default.

## Pending outside this module

- `miot-tracking` and the StreamHub db-writer reject records without `gps` (NullPointerException); until they accept them, those records stay in the packet log.
- Idempotency by `request_id` in `asset_data`, for duplicates across pods and restarts.
- Own Deployment with only this component, an L4 Service with a static IP, PDB and preStop.
- Sub-accounts sharing their parent's GPS client id are not refused yet (places does it with `GeofenceOrganizationScope`).
- Registry changes reach other pods within `registry-refresh` (no LISTEN/NOTIFY yet).
- Over-speeding start/end is still paired by state in memory; to decide by the I/O 255 value once verified on a real device.
- Connection guide variants (primary server vs Duplicate) and APN values per operator.
- Traccar and the MQTT broker as deployments of their own (persistent volume, TLS certificates per device, issuing a device certificate from the platform).
- Command answers over MQTT: the answer format is taken from the device's data topic (`{"RSP": ...}` and similar); to confirm on a real FMB with MQTT firmware. With several replicas the answer may reach a replica that did not send the command: correlate answers in the database before running MQTT with more than one replica.
- UDP: a native device that only reports over UDP cannot answer the activation check (no session); rate limit per IMEI and IP.
- Metrics per channel (`channel` tag) and Traccar counters (unknown, wrong channel) as Micrometer metrics.
- Traccar: duplicate key by `fixTime` only; alarms without a fix may repeat the last `fixTime`.
- Models marked unverified in the catalog: confirm their input IDs and Traccar attributes with a real device.
