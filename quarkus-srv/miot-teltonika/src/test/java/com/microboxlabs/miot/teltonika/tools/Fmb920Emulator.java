package com.microboxlabs.miot.teltonika.tools;

import static com.microboxlabs.miot.teltonika.mapping.TeltonikaIo.*;

import java.io.Closeable;
import java.io.DataInputStream;
import java.io.EOFException;
import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.net.SocketTimeoutException;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import com.microboxlabs.miot.teltonika.protocol.Codec12;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Emulates a Teltonika FMB920 talking to the receiver over TCP: sends its IMEI, then AVL packets,
 * and reads every acknowledgment the way the device does.
 *
 * <p>Command line (after {@code ./mvnw -pl miot-teltonika test-compile}), see README.md:
 * <pre>
 * java -cp "miot-teltonika/target/test-classes:miot-teltonika/target/classes" \
 *   com.microboxlabs.miot.teltonika.tools.Fmb920Emulator --scenario route
 * </pre>
 */
public final class Fmb920Emulator implements Closeable {

    /** Wiki example 1, Codec 8, one record (IMEI 356307042441013). */
    public static final String WIKI_CODEC8_ONE_RECORD =
            "000000000000003608010000016B40D8EA30010000000000000000000000000000000105021503010101"
                    + "425E0F01F10000601A014E0000000000000000010000C7CF";
    /** Wiki example 3, Codec 8, two records. */
    public static final String WIKI_CODEC8_TWO_RECORDS =
            "000000000000004308020000016B40D57B4801000000000000000000000000000000010101010000000000"
                    + "00016B40D5C198010000000000000000000000000000000101010101000000020000252C";
    /** Wiki example, Codec 8 Extended, one record. */
    public static final String WIKI_CODEC8E_ONE_RECORD =
            "000000000000004A8E010000016B412CEE00010000000000000000000000000000000001000500010001"
                    + "0100010011001D00010010015E2C880002000B000000003544C87A000E000000001DD7E06A0000"
                    + "0100002994";

    private static final HexFormat HEX = HexFormat.of().withUpperCase();

    private final Socket socket;
    private final DataInputStream in;
    private final OutputStream out;

    private Fmb920Emulator(Socket socket) throws IOException {
        this.socket = socket;
        this.in = new DataInputStream(socket.getInputStream());
        this.out = socket.getOutputStream();
    }

    public static Fmb920Emulator connect(String host, int port, Duration readTimeout) throws IOException {
        var socket = new Socket();
        socket.connect(new InetSocketAddress(host, port), (int) Duration.ofSeconds(5).toMillis());
        socket.setSoTimeout((int) readTimeout.toMillis());
        return new Fmb920Emulator(socket);
    }

    /** Sends the IMEI; true when the receiver answers 01. */
    public boolean login(String imei) throws IOException {
        out.write(AvlPacketEncoder.imei(imei));
        out.flush();
        int answer = in.read();
        return answer == 0x01;
    }

    /** Sends a packet in one write and waits for the 4-byte acknowledgment; -1 if none arrives. */
    public int send(byte[] packet) throws IOException {
        out.write(packet);
        out.flush();
        return readAck();
    }

    /** Sends a packet in small pieces, as a slow mobile link may deliver it. */
    public int sendFragmented(byte[] packet, int pieceSize) throws IOException {
        for (int i = 0; i < packet.length; i += pieceSize) {
            out.write(packet, i, Math.min(pieceSize, packet.length - i));
            out.flush();
        }
        return readAck();
    }

    /** Sends a packet without waiting for the acknowledgment (connection drop simulation). */
    public void sendWithoutWaiting(byte[] packet) throws IOException {
        out.write(packet);
        out.flush();
    }

    public int readAck() throws IOException {
        try {
            return in.readInt();
        } catch (SocketTimeoutException | EOFException e) {
            // No answer in time, or the receiver closed the connection: no acknowledgment.
            return -1;
        }
    }

    /**
     * Reads a Codec 12 command the receiver sent; null if none arrives within the read timeout.
     * The device answers commands only between data packets, as a real one does.
     */
    public String readCommand() throws IOException {
        try {
            int preamble = in.readInt();
            if (preamble != 0) {
                throw new IOException("unexpected bytes instead of a Codec 12 command");
            }
            byte[] data = new byte[in.readInt()];
            in.readFully(data);
            in.readInt(); // CRC
            return Codec12.decodeCommand(data);
        } catch (SocketTimeoutException | EOFException e) {
            return null;
        }
    }

    /** Sends a Codec 12 response, as the device does after executing a command. */
    public void answer(String response) throws IOException {
        out.write(Codec12.encodeResponse(response));
        out.flush();
    }

    /** Values the emulated device holds for getparam; 2015 is the activation code the installer loaded. */
    public static final java.util.Map<String, String> PARAMS = new java.util.concurrent.ConcurrentHashMap<>(
            java.util.Map.of("10050", "30", "10055", "30", "10000", "600", "10005", "120"));

    /** What an FMB920 answers to the queries the platform may send. */
    public static String simulatedAnswer(String command) {
        if (command.startsWith("setparam")) {
            for (String pair : command.substring("setparam ".length()).split(";")) {
                String[] kv = pair.split(":", 2);
                PARAMS.put(kv[0], kv[1]);
            }
            return "New value " + command.substring("setparam ".length());
        }
        if (command.startsWith("getparam ")) {
            String id = command.substring("getparam ".length()).trim();
            return "Param ID:" + id + " Value:" + PARAMS.getOrDefault(id, "");
        }
        return switch (command) {
            case "getinfo" -> "INI:2026/11/16 12:00 RTC:2026/11/16 12:30 RST:2 ERR:0 SR:0 BR:0 CF:0 FG:0 FL:0 "
                    + "TU:0/0 UT:0 SMS:0 NOGPS:0:0 GPS:3 SAT:11 RS:3 RF:65 SF:1 MD:0";
            case "getver" -> "Ver:03.29.00_00 GPS:AXN_5.1.6 Hw:FMB920 Mod:13 IMEI:356307042441013";
            case "getgps" -> "GPS:1 Sat:11 Lat:-33.448900 Long:-70.669300 Alt:570 Speed:0 Dir:145";
            case "getio" -> "DI1:1 AIN1:0 DO1:0";
            case "getstatus" -> "Data Link: 1 GPRS: 1 Phone: 0 SIM: 0 OP: 73001 Signal: 4";
            default -> "Unknown command";
        };
    }

    /** True when the receiver closed the connection. */
    public boolean isClosedByServer() throws IOException {
        try {
            return in.read() == -1;
        } catch (SocketTimeoutException e) {
            return false;
        } catch (IOException e) {
            return true;
        }
    }

    @Override
    public void close() throws IOException {
        socket.close();
    }

    public static byte[] hex(String hex) {
        return HEX.parseHex(hex);
    }

    /**
     * A synthetic trip in Santiago: ignition on with iButton, driving, a harsh braking event,
     * a stop and ignition off. One record every {@code step}.
     */
    public static List<AvlPacketEncoder.Record> santiagoTrip(Instant start, Duration step) {
        List<AvlPacketEncoder.Record> trip = new ArrayList<>();
        double lat = -33.4489;
        double lon = -70.6693;
        long odometer = 152_340_000;
        for (int i = 0; i < 20; i++) {
            boolean moving = i > 0 && i < 18;
            int speed = moving ? 40 + (i % 5) * 8 : 0;
            if (moving) {
                lat -= 0.0012;
                lon += 0.0009;
                odometer += speed * 1000L * step.toSeconds() / 3600;
            }
            var r = new AvlPacketEncoder.Record(start.plus(step.multipliedBy(i)))
                    .position(lat, lon, 570, 145, 11, speed)
                    .io1(IGNITION, i < 19 ? 1 : 0)
                    .io1(MOVEMENT, moving ? 1 : 0)
                    .io1(GNSS_STATUS, 1)
                    .io1(GSM_SIGNAL, 4)
                    .io1(DIGITAL_INPUT_1, i < 19 ? 1 : 0)
                    .io2(EXTERNAL_VOLTAGE, i < 19 ? 27_850 : 24_610)
                    .io2(BATTERY_VOLTAGE, 4_080)
                    .io2(GNSS_HDOP, 8)
                    .io2(GSM_CELL_ID, 31_207)
                    .io2(GSM_AREA_CODE, 5_402)
                    .io4(TOTAL_ODOMETER, odometer)
                    .io4(ACTIVE_GSM_OPERATOR, 73_001)
                    .io8(IBUTTON, 0x01_36_A2_4F_00_00_00_C7L);
            if (i == 0 || i == 19) {
                r.event(IGNITION).priority(1);
            }
            if (i == 9) {
                r.event(GREEN_DRIVING_TYPE).priority(1)
                        .io1(GREEN_DRIVING_TYPE, 2)
                        .io1(GREEN_DRIVING_VALUE, 64);
            }
            trip.add(r);
        }
        return trip;
    }

    public static void main(String[] args) throws Exception {
        String host = "127.0.0.1";
        int port = 5027;
        String imei = "356307042441013";
        String scenario = "route";
        int devices = 100;
        int seconds = 60;
        for (int i = 0; i < args.length - 1; i += 2) {
            switch (args[i]) {
                case "--host" -> host = args[i + 1];
                case "--port" -> port = Integer.parseInt(args[i + 1]);
                case "--imei" -> imei = args[i + 1];
                case "--scenario" -> scenario = args[i + 1];
                case "--devices" -> devices = Integer.parseInt(args[i + 1]);
                case "--seconds" -> seconds = Integer.parseInt(args[i + 1]);
                case "--code" -> PARAMS.put("2015", args[i + 1]);
                default -> throw new IllegalArgumentException("Unknown option " + args[i]);
            }
        }
        switch (scenario) {
            case "wiki" -> runWiki(host, port, imei);
            case "route" -> runRoute(host, port, imei);
            case "outage" -> runOutage(host, port, imei);
            case "commands" -> runCommands(host, port, imei, seconds);
            case "anomalies" -> runAnomalies(host, port, imei);
            case "load" -> runLoad(host, port, devices, seconds);
            default -> throw new IllegalArgumentException("Scenarios: wiki, route, outage, commands, anomalies, load");
        }
    }

    private static void runWiki(String host, int port, String imei) throws IOException {
        try (var device = connect(host, port, Duration.ofSeconds(5))) {
            report("login " + imei, device.login(imei) ? "accepted (01)" : "rejected (00)");
            report("wiki codec 8, 1 record", ack(device.send(hex(WIKI_CODEC8_ONE_RECORD))));
            report("wiki codec 8, 2 records", ack(device.send(hex(WIKI_CODEC8_TWO_RECORDS))));
            report("wiki codec 8E, 1 record", ack(device.send(hex(WIKI_CODEC8E_ONE_RECORD))));
        }
    }

    private static void runRoute(String host, int port, String imei) throws IOException {
        List<AvlPacketEncoder.Record> trip = santiagoTrip(
                Instant.now().minusSeconds(600).truncatedTo(java.time.temporal.ChronoUnit.SECONDS),
                Duration.ofSeconds(30));
        try (var device = connect(host, port, Duration.ofSeconds(5))) {
            report("login " + imei, device.login(imei) ? "accepted (01)" : "rejected (00)");
            for (int i = 0; i < trip.size(); i += 5) {
                var batch = trip.subList(i, Math.min(i + 5, trip.size()));
                byte[] packet = AvlPacketEncoder.codec8Extended(batch);
                report("packet %d (%d records, %d bytes)".formatted(i / 5 + 1, batch.size(), packet.length),
                        ack(device.sendFragmented(packet, 37)));
            }
            report("packet with bad CRC", ack(device.send(AvlPacketEncoder.withBadCrc(
                    AvlPacketEncoder.codec8Extended(trip.subList(0, 1))))));
        }
    }

    /** Sends a packet, drops the connection before the ack, reconnects and sends it again. */
    private static void runOutage(String host, int port, String imei) throws IOException, InterruptedException {
        List<AvlPacketEncoder.Record> trip = santiagoTrip(Instant.now().minusSeconds(300)
                .truncatedTo(java.time.temporal.ChronoUnit.SECONDS), Duration.ofSeconds(10));
        byte[] packet = AvlPacketEncoder.codec8Extended(trip.subList(0, 5));
        try (var device = connect(host, port, Duration.ofSeconds(5))) {
            report("login " + imei, device.login(imei) ? "accepted (01)" : "rejected (00)");
            device.sendWithoutWaiting(packet);
            report("connection dropped before the ack", "");
        }
        Thread.sleep(500);
        try (var device = connect(host, port, Duration.ofSeconds(5))) {
            report("reconnect " + imei, device.login(imei) ? "accepted (01)" : "rejected (00)");
            report("same packet again (5 records)", ack(device.send(packet)));
        }
    }

    /** Logs in, sends one packet and answers every command for {@code seconds}. */
    private static void runCommands(String host, int port, String imei, int seconds) throws IOException {
        try (var device = connect(host, port, Duration.ofSeconds(2))) {
            report("login " + imei, device.login(imei) ? "accepted (01)" : "rejected (00)");
            var trip = santiagoTrip(Instant.now().minusSeconds(60).truncatedTo(java.time.temporal.ChronoUnit.SECONDS),
                    Duration.ofSeconds(5));
            report("packet (1 record)", ack(device.send(AvlPacketEncoder.codec8Extended(trip.subList(0, 1)))));
            long until = System.currentTimeMillis() + seconds * 1000L;
            while (System.currentTimeMillis() < until) {
                String command = device.readCommand();
                if (command != null) {
                    String answer = simulatedAnswer(command);
                    device.answer(answer);
                    report("command received: " + command, "answered: " + answer);
                }
            }
        }
    }

    /** A packet with a wrong device clock and a valid-CRC packet in an unsupported codec. */
    private static void runAnomalies(String host, int port, String imei) throws IOException {
        try (var device = connect(host, port, Duration.ofSeconds(5))) {
            report("login " + imei, device.login(imei) ? "accepted (01)" : "rejected (00)");
            var future = santiagoTrip(Instant.now().plus(Duration.ofDays(400)), Duration.ofSeconds(30)).subList(0, 2);
            report("2 records dated next year (RTC wrong)", ack(device.send(AvlPacketEncoder.codec8Extended(future))));
            report("codec 16 packet with valid CRC", ack(device.send(AvlPacketEncoder.unsupportedCodec())));
            var ok = santiagoTrip(Instant.now().minusSeconds(30).truncatedTo(java.time.temporal.ChronoUnit.SECONDS),
                    Duration.ofSeconds(5)).subList(0, 1);
            report("normal packet afterwards", ack(device.send(AvlPacketEncoder.codec8Extended(ok))));
        }
    }

    /**
     * {@code devices} connections at once (IMEIs from loadImei), each sending one record every
     * 30 s for {@code seconds}. Reports acknowledged records, missing acks and ack latency.
     */
    private static void runLoad(String host, int port, int devices, int seconds) throws InterruptedException {
        ExecutorService pool = Executors.newVirtualThreadPerTaskExecutor();
        AtomicLong acked = new AtomicLong();
        AtomicLong missing = new AtomicLong();
        AtomicLong rejected = new AtomicLong();
        AtomicLong latencyMs = new AtomicLong();
        AtomicLong maxLatencyMs = new AtomicLong();
        AtomicLong reconnects = new AtomicLong();
        CountDownLatch done = new CountDownLatch(devices);
        long started = System.currentTimeMillis();
        for (int n = 0; n < devices; n++) {
            String imei = loadImei(n);
            long offset = (long) (Math.random() * 30_000);
            pool.submit(() -> {
                try (var device = connectWithRetry(host, port, reconnects)) {
                    if (!device.login(imei)) {
                        rejected.incrementAndGet();
                        return null;
                    }
                    Thread.sleep(offset);
                    while (System.currentTimeMillis() - started < seconds * 1000L) {
                        var r = santiagoTrip(Instant.now().truncatedTo(java.time.temporal.ChronoUnit.MILLIS),
                                Duration.ofSeconds(1)).get(5);
                        long t0 = System.nanoTime();
                        int a = device.send(AvlPacketEncoder.codec8Extended(List.of(r)));
                        long ms = (System.nanoTime() - t0) / 1_000_000;
                        if (a == 1) {
                            acked.incrementAndGet();
                            latencyMs.addAndGet(ms);
                            maxLatencyMs.accumulateAndGet(ms, Math::max);
                        } else {
                            missing.incrementAndGet();
                        }
                        Thread.sleep(30_000);
                    }
                } catch (Exception e) {
                    missing.incrementAndGet();
                } finally {
                    done.countDown();
                }
                return null;
            });
        }
        done.await(seconds + 120L, TimeUnit.SECONDS);
        pool.shutdownNow();
        long a = acked.get();
        report("devices", Integer.toString(devices));
        report("records acknowledged", Long.toString(a));
        report("records without ack", Long.toString(missing.get()));
        report("devices rejected", Long.toString(rejected.get()));
        report("connection retries", Long.toString(reconnects.get()));
        report("ack latency avg / max", (a == 0 ? 0 : latencyMs.get() / a) + " ms / " + maxLatencyMs.get() + " ms");
    }

    /** Like the device: a failed connection is retried after a pause; its records wait in memory. */
    private static Fmb920Emulator connectWithRetry(String host, int port, AtomicLong reconnects)
            throws IOException, InterruptedException {
        IOException last = null;
        for (int attempt = 0; attempt < 6; attempt++) {
            try {
                return connect(host, port, Duration.ofSeconds(25));
            } catch (IOException e) {
                last = e;
                reconnects.incrementAndGet();
                Thread.sleep(1_000L * (attempt + 1) + (long) (Math.random() * 1_000));
            }
        }
        throw last;
    }

    /** IMEI of load device {@code n}: 15 digits with a valid Luhn check digit ({@code 35000000nnnnnnC}). */
    public static String loadImei(int n) {
        String body = "35000000" + String.format("%06d", n);
        int sum = 0;
        for (int i = 0; i < body.length(); i++) {
            int d = body.charAt(body.length() - 1 - i) - '0';
            if (i % 2 == 0) {
                d *= 2;
                if (d > 9) {
                    d -= 9;
                }
            }
            sum += d;
        }
        return body + (10 - sum % 10) % 10;
    }

    private static String ack(int ack) {
        return ack < 0 ? "no ack" : "ack %08X (%d records)".formatted(ack, ack);
    }

    private static void report(String step, String result) {
        System.out.printf("%-42s %s%n", step, result);
    }
}
