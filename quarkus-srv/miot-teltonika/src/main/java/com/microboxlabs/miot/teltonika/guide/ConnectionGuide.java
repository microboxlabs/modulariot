package com.microboxlabs.miot.teltonika.guide;

import com.microboxlabs.miot.teltonika.catalog.DeviceModel;
import com.microboxlabs.miot.teltonika.profile.ConfigProfile;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * What an installer loads into a device so it reports to the platform the way the Control Tower
 * needs: server, protocol and the standard profile (frequency, ignition source, I/O). Parameter IDs:
 * https://wiki.teltonika-gps.com/view/FMB920_Parameter_list (FMB.Ver.03.29 and newer).
 *
 * <p>Every native Teltonika model of the catalog (FMB920 family and FMB1xx/FMC1xx) uses these IDs;
 * the catalog marks the ones not yet verified. Brands through Traccar get {@link #traccarGuide}.
 */
public final class ConnectionGuide {

    /** One parameter to set, with the reason shown to the installer. */
    public record Parameter(int id, String name, String value, String reason) {
    }

    /** The guide for one device. */
    public record Guide(String model, String host, int port, String protocol, List<Parameter> parameters,
            String gprsCommand, List<String> smsCommands, List<String> notes) {
    }

    static final int SMS_LIMIT = 160;
    /** "Device ID" parameter: carries the activation code that proves possession of the device. */
    public static final int ACTIVATION_PARAM = 2015;

    private final String host;
    private final int port;
    private final String traccarHost;

    public ConnectionGuide(String host, int port) {
        this(host, port, host);
    }

    /** {@code traccarHost}: the address the Traccar gateway listens on, for brands other than Teltonika. */
    public ConnectionGuide(String host, int port, String traccarHost) {
        this.host = host;
        this.port = port;
        this.traccarHost = traccarHost == null || traccarHost.isBlank() ? host : traccarHost;
    }

    public Guide guide(String model) {
        return guide(model, null);
    }

    /**
     * The guide for one device. While it is pending, the activation code goes first: the platform
     * reads it back from the device to prove the installer has the device in hand.
     */
    public Guide guide(String model, String activationCode) {
        return guide(model, activationCode, null);
    }

    /**
     * The guide with the organization's configuration profile: its values replace the standard ones
     * (frequency, ignition, sleep, I/O) and its extra parameters are added.
     */
    public Guide guide(String model, String activationCode, ConfigProfile profile) {
        String m = model == null || model.isBlank() ? "FMB920" : model.trim().toUpperCase(Locale.ROOT);
        List<Parameter> params = new ArrayList<>();
        if (activationCode != null) {
            params.add(new Parameter(ACTIVATION_PARAM, "Device ID", activationCode,
                    "Código de activación: prueba que el equipo es de esta organización"));
        }
        params.add(new Parameter(2004, "Domain", host, "Servidor de la plataforma"));
        params.add(new Parameter(2005, "Port", Integer.toString(port), "Puerto del receptor"));
        params.add(new Parameter(2006, "Protocol", "0", "TCP"));
        params.add(new Parameter(113, "Data Protocol", "1", "Codec 8 Extended"));
        params.add(new Parameter(1002, "Sort by", "1", "Envía primero lo más antiguo: llega en orden tras un corte"));
        params.add(new Parameter(1001, "Response timeout", "30", "Espera de confirmación antes de reenviar"));
        params.addAll(standardProfile());
        params.add(new Parameter(101, "Ignition settings", "1",
                "Ignición por DIN1 cableado al contacto. Si no se cablea, usar 4 (voltaje) y ajustar 105"));
        params.add(new Parameter(102, "Sleep settings", "0", "Sin sueño: el equipo no corta la conexión"));
        params.add(new Parameter(50160, "Total Odometer priority", "1", "Envía el odómetro"));
        params.add(new Parameter(50170, "Digital Input 1 priority", "1", "Envía DIN1"));
        params.add(new Parameter(50390, "iButton priority", "1", "Envía la llave del conductor"));
        params.add(new Parameter(50100, "GSM Cell ID priority", "1", "Envía la celda, para diagnóstico"));
        params.add(new Parameter(50110, "GSM Area Code priority", "1", "Envía el área, para diagnóstico"));
        params.add(new Parameter(50140, "Active GSM Operator priority", "1", "Envía el operador"));
        if (profile != null) {
            applyProfile(params, profile);
        }
        String setparam = setparam(params);
        return new Guide(m, host, port, "TCP · Codec 8 Extended", List.copyOf(params), setparam,
                smsCommands(params),
                List.of("Cargar también el APN de la SIM (2001, y usuario y clave en 2002/2003 si el operador"
                                + " los exige); sin APN el equipo no se conecta.",
                        "El comando SMS lleva dos espacios al inicio cuando el equipo no tiene usuario ni clave"
                                + " SMS; si los tiene: \"<usuario> <clave> setparam ...\".",
                        "Para seguir reportando también al proveedor GPS actual: 2010=2 (Duplicate) y su servidor"
                                + " en 2007/2008/2009, o dejar la plataforma como servidor de respaldo.",
                        "Escenarios de conducción brusca, exceso de velocidad, choque, desenchufe y jamming se"
                                + " activan en el configurador (Features); la plataforma los recibe como eventos.",
                        "Verificar estos valores contra la lista de parámetros del firmware instalado."));
    }

    private static void applyProfile(List<Parameter> params, ConfigProfile profile) {
        String reason = "Perfil " + profile.name();
        profile.params().forEach((id, value) -> {
            for (int i = 0; i < params.size(); i++) {
                Parameter p = params.get(i);
                if (p.id() == id) {
                    params.set(i, new Parameter(id, p.name(), value, reason));
                    return;
                }
            }
            params.add(new Parameter(id, NAMES.getOrDefault(id, "Parámetro " + id), value, reason));
        });
    }

    private static final Map<Integer, String> NAMES = Map.ofEntries(
            Map.entry(101, "Ignition settings"), Map.entry(102, "Sleep settings"),
            Map.entry(104, "High voltage level"), Map.entry(105, "Low voltage level"),
            Map.entry(10000, "Min Period (stop)"), Map.entry(10004, "Min Saved Records (stop)"),
            Map.entry(10005, "Send Period (stop)"), Map.entry(10050, "Min Period (moving)"),
            Map.entry(10051, "Min Distance (moving)"), Map.entry(10052, "Min Angle (moving)"),
            Map.entry(10054, "Min Saved Records (moving)"), Map.entry(10055, "Send Period (moving)"));

    /**
     * The guide for a brand that arrives through Traccar: the device is configured with the vendor's
     * own tool or SMS, pointing to the gateway's port for its protocol. No activation code: the claim
     * waits for a platform owner's approval.
     */
    public Guide traccarGuide(DeviceModel model) {
        if (model.traccarPort() == null) {
            throw new IllegalArgumentException("model " + model.code() + " has no Traccar port");
        }
        List<String> notes = new ArrayList<>();
        notes.add("Configurar en el equipo el servidor " + traccarHost + " y el puerto " + model.traccarPort()
                + " (protocolo " + model.protocol() + "), con la herramienta o los SMS del fabricante.");
        notes.add("El equipo se identifica con su IMEI o ID de equipo: debe ser el mismo registrado aquí.");
        notes.add("Cargar el APN de la SIM; sin APN el equipo no se conecta.");
        notes.add("La activación la aprueba la plataforma; mientras tanto los datos se guardan y se publican al"
                + " aprobar.");
        notes.add("Entradas: el equipo informa in1..in4 y adc1..adc2 según su protocolo; el perfil de entradas les"
                + " da nombre y eventos.");
        if (!model.verified()) {
            notes.add("Modelo aún no verificado de punta a punta: revisar los primeros datos con la captura de"
                    + " paquetes.");
        }
        if (model.notes() != null) {
            notes.add(model.notes());
        }
        return new Guide(model.code(), traccarHost, model.traccarPort(), "Traccar · " + model.protocol(), List.of(),
                null, List.of(), notes);
    }

    /** Standard reporting frequency (Control Tower). */
    public static List<Parameter> standardProfile() {
        return List.of(
                new Parameter(10050, "Min Period (moving)", "30", "Un registro cada 30 s en movimiento"),
                new Parameter(10051, "Min Distance (moving)", "100", "O cada 100 m"),
                new Parameter(10052, "Min Angle (moving)", "10", "O en cada giro de 10°"),
                new Parameter(10055, "Send Period (moving)", "30", "Envía cada 30 s"),
                new Parameter(10000, "Min Period (stop)", "600", "Detenido: un registro cada 10 min"),
                new Parameter(10005, "Send Period (stop)", "120", "Detenido: envía cada 2 min"));
    }

    /** High-frequency reporting while the Control Tower handles a case. */
    public static List<Parameter> intensiveProfile() {
        return List.of(
                new Parameter(10050, "Min Period (moving)", "10", "Un registro cada 10 s"),
                new Parameter(10055, "Send Period (moving)", "10", "Envía cada 10 s"),
                new Parameter(10000, "Min Period (stop)", "30", "Detenido: cada 30 s"),
                new Parameter(10005, "Send Period (stop)", "30", "Detenido: envía cada 30 s"));
    }

    /** {@code setparam id:value;id:value} for GPRS (Codec 12) or SMS. */
    public static String setparam(List<Parameter> params) {
        Map<Integer, String> ordered = new LinkedHashMap<>();
        params.forEach(p -> ordered.put(p.id(), p.value()));
        return "setparam " + ordered.entrySet().stream()
                .map(e -> e.getKey() + ":" + e.getValue())
                .collect(Collectors.joining(";"));
    }

    /** SMS carry at most 160 characters: the parameters split into several {@code setparam} messages. */
    static List<String> smsCommands(List<Parameter> params) {
        List<String> out = new ArrayList<>();
        List<Parameter> chunk = new ArrayList<>();
        for (Parameter p : params) {
            chunk.add(p);
            if (("  " + setparam(chunk)).length() > SMS_LIMIT) {
                chunk.removeLast();
                out.add("  " + setparam(chunk));
                chunk = new ArrayList<>(List.of(p));
            }
        }
        if (!chunk.isEmpty()) {
            out.add("  " + setparam(chunk));
        }
        return out;
    }

    /** Seconds between records the standard profile expects while moving. */
    public static int expectedMovingIntervalSeconds() {
        return 30;
    }
}
