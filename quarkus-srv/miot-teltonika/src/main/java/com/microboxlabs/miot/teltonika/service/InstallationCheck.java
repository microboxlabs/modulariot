package com.microboxlabs.miot.teltonika.service;

import com.microboxlabs.miot.teltonika.guide.ConnectionGuide;
import com.microboxlabs.miot.teltonika.monitor.DeviceStatus;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import com.microboxlabs.miot.teltonika.device.Device;
import java.util.ArrayList;
import java.util.List;

/**
 * What an installer checks before leaving the vehicle, from the device's status: it reports, it has
 * a GPS fix, the ignition was seen on and off, it reads the iButton, the signal and power are good,
 * it reports at the expected frequency and without errors. Required items decide {@code ready}.
 */
public final class InstallationCheck {

    static final Duration REPORTING = Duration.ofMinutes(5);
    static final Duration FIX = Duration.ofMinutes(10);
    static final int MIN_EXTERNAL_MV = 9_000;

    public enum Result { OK, WARN, FAIL, PENDING }

    /** One check, with the action for the installer when it is not OK. */
    public record Item(String code, String title, boolean required, Result result, String detail) {
    }

    /** The whole check. */
    public record Report(String imei, boolean ready, OffsetDateTime checkedAt, List<Item> items) {
    }

    private InstallationCheck() {
    }

    public static Report evaluate(Device device, DeviceStatus s, Instant now) {
        String imei = device.imei();
        List<Item> items = new ArrayList<>();
        items.add(new Item("activation", "Equipo activado", true, device.pending() ? Result.PENDING : Result.OK,
                device.pending() ? "Cargar el código " + device.activationCode() + " en el parámetro 2015 (está en la"
                        + " guía de conexión); la plataforma lo confirma sola al conectarse el equipo"
                        : "Posesión confirmada"));
        if (s == null || s.lastSeenAt() == null) {
            items.add(new Item("reporting", "Reporta a la plataforma", true, Result.FAIL,
                    "El equipo no se ha conectado. Revisar servidor, puerto y APN (guía de conexión)."));
            return new Report(imei, false, OffsetDateTime.ofInstant(now, ZoneOffset.UTC), items);
        }
        boolean recent = s.lastSeenAt().toInstant().isAfter(now.minus(REPORTING));
        items.add(new Item("reporting", "Reporta a la plataforma", true, recent ? Result.OK : Result.FAIL,
                recent ? "Último contacto " + ago(s.lastSeenAt(), now)
                        : "Sin contacto hace " + ago(s.lastSeenAt(), now) + ". Revisar alimentación, SIM y cobertura."));
        boolean fix = s.lastFixAt() != null && s.lastFixAt().toInstant().isAfter(now.minus(FIX));
        items.add(new Item("gps_fix", "Posición GPS", true, fix ? Result.OK : Result.FAIL,
                fix ? "Con posición, " + (s.lastSatellites() == null ? "?" : s.lastSatellites()) + " satélites"
                        : "Sin posición reciente. Revisar que la antena GPS vea el cielo."));
        boolean on = s.ignitionOnSeenAt() != null;
        boolean off = s.ignitionOffSeenAt() != null;
        items.add(new Item("ignition", "Ignición detectada", true, on && off ? Result.OK : Result.PENDING,
                on && off ? "Se vio encendida y apagada"
                        : on ? "Se vio encendida; falta apagar el motor para confirmar"
                        : off ? "Se vio apagada; falta encender el motor para confirmar"
                        : "Encender y apagar el motor. Si no cambia, revisar el cableado de DIN1 o el parámetro 101."));
        int mv = s.lastExternalVoltageMv() == null ? 0 : s.lastExternalVoltageMv();
        items.add(new Item("power", "Alimentación del vehículo", true,
                s.lastExternalVoltageMv() == null ? Result.PENDING : mv >= MIN_EXTERNAL_MV ? Result.OK : Result.FAIL,
                s.lastExternalVoltageMv() == null ? "El equipo aún no informa el voltaje externo"
                        : String.format("%.1f V%s", mv / 1000d, mv >= MIN_EXTERNAL_MV ? ""
                        : ": bajo, el equipo puede estar a batería interna. Revisar la conexión a +12/24 V")));
        Integer gsm = s.lastGsmSignal();
        items.add(new Item("gsm", "Señal celular", false,
                gsm == null ? Result.PENDING : gsm >= 3 ? Result.OK : gsm == 2 ? Result.WARN : Result.FAIL,
                gsm == null ? "El equipo aún no informa la señal" : "Nivel " + gsm + " de 5"
                        + (gsm < 3 ? ": baja, considerar otra ubicación del equipo" : "")));
        items.add(new Item("ibutton", "Lectura de iButton", false,
                s.lastIbutton() == null ? Result.PENDING : Result.OK,
                s.lastIbutton() == null ? "Si el vehículo usa llave de conductor, acercarla al lector"
                        : "Última llave " + s.lastIbutton()));
        Integer interval = s.lastRecordIntervalS();
        int expected = ConnectionGuide.expectedMovingIntervalSeconds();
        items.add(new Item("frequency", "Frecuencia de reporte", false,
                interval == null ? Result.PENDING : interval <= expected * 2 ? Result.OK : Result.WARN,
                interval == null ? "Se calcula con dos registros"
                        : "Último intervalo " + interval + " s" + (interval <= expected * 2 ? ""
                        : ". En movimiento se esperan ~" + expected + " s: si el vehículo se está moviendo, el equipo"
                        + " no detecta el movimiento o la ignición (revisar DIN1 y el parámetro 101)")));
        Integer dataMode = s.lastDataMode();
        items.add(new Item("data_mode", "Red celular local", false,
                dataMode == null ? Result.PENDING : dataMode <= 1 ? Result.OK : Result.WARN,
                dataMode == null ? "El equipo aún no informa el modo de datos (I/O 80)"
                        : dataMode <= 1 ? "Red local del operador"
                        : "El equipo está en roaming o en red desconocida: la frecuencia de reporte usa otros"
                        + " parámetros que los de la guía"));
        long errors = s.crcErrors() + s.quarantinedPackets();
        items.add(new Item("errors", "Paquetes sin errores", false, errors == 0 ? Result.OK : Result.WARN,
                errors == 0 ? "Sin errores" : errors + " paquetes con error; revisar la bitácora de paquetes"));
        Integer sleep = s.lastSleepMode();
        items.add(new Item("sleep", "Sin modo sueño", false,
                sleep == null ? Result.PENDING : sleep == 0 ? Result.OK : Result.WARN,
                sleep == null ? "El equipo aún no informa el modo sueño"
                        : sleep == 0 ? "No duerme" : "Modo sueño " + sleep + ": el equipo corta la conexión (parámetro 102)"));
        boolean ready = items.stream().filter(Item::required).allMatch(i -> i.result() == Result.OK);
        return new Report(imei, ready, OffsetDateTime.ofInstant(now, ZoneOffset.UTC), items);
    }

    private static String ago(OffsetDateTime t, Instant now) {
        long s = Math.max(0, Duration.between(t.toInstant(), now).toSeconds());
        if (s < 120) {
            return s + " s";
        }
        if (s < 7200) {
            return s / 60 + " min";
        }
        return s / 3600 + " h";
    }
}
