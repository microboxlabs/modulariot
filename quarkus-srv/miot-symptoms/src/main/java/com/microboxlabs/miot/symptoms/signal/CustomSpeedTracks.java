package com.microboxlabs.miot.symptoms.signal;

import io.smallrye.config.ConfigMapping;
import java.util.Optional;
import java.util.regex.Pattern;

/**
 * Organizations' own speed polygons in the legacy speed database, read as {@link SpeedZones}. Each row carries its
 * organization and its direction rule:
 *
 * <table>
 * <caption>Columns</caption>
 * <tr><th>Column</th><th>Zone</th></tr>
 * <tr><td>{@code client_id}</td><td>the organization (GPS client id); rows without it are not loaded</td></tr>
 * <tr><td>{@code forward_from}, {@code forward_to}</td><td>{@code speed_forward} when the bearing of travel is in
 * the range (0–360, wrapping past 360), else {@code speed_backward}; without a bearing the vehicle's last bearing is
 * used</td></tr>
 * <tr><td>{@code single_limit}</td><td>one limit, {@code coalesce(speed_backward, speed_forward)}; wins over a
 * range</td></tr>
 * <tr><td>neither</td><td>not loaded, as the legacy gives no limit to sites ruled only by {@code order}</td></tr>
 * </table>
 *
 * <p>{@code azimuth_degree} is the zone's heading filter. {@code name}, when the table has it, names the zone in the
 * case's speed limit; it is read through the row's JSON so a table without it still loads.
 */
final class CustomSpeedTracks {

    /** SQL state of a column the table does not have yet. */
    static final String UNDEFINED_COLUMN = "42703";

    @ConfigMapping(prefix = "miot.symptoms.speed.custom-tracks")
    public interface Settings {
        /** The table, optionally schema-qualified. No polygons without it. */
        Optional<String> table();
    }

    /** One table row. */
    record Row(int id, String clientId, Integer forward, Integer backward, Integer azimuth, Integer forwardFrom,
            Integer forwardTo, boolean singleLimit, String shape, String name) {

        Row(int id, String clientId, Integer forward, Integer backward, Integer azimuth, Integer forwardFrom,
                Integer forwardTo, boolean singleLimit, String shape) {
            this(id, clientId, forward, backward, azimuth, forwardFrom, forwardTo, singleLimit, shape, null);
        }
    }

    private static final Pattern TABLE = Pattern.compile("[A-Za-z_]\\w*(\\.[A-Za-z_]\\w*)?");

    private static final String SELECT_TRACKS = """
            SELECT t.id, t.client_id, t.speed_forward, t.speed_backward, t.azimuth_degree, t.forward_from,
                   t.forward_to, t.single_limit, ST_AsGeoJSON(t.geom) AS shape,
                   (to_jsonb(t) - 'geom') ->> 'name' AS name
              FROM %s t WHERE t.geom IS NOT NULL
            """;

    private CustomSpeedTracks() {
    }

    static String sql(String table) {
        if (!TABLE.matcher(table).matches()) {
            throw new IllegalArgumentException("Invalid custom speed tracks table name");
        }
        return SELECT_TRACKS.formatted(table);
    }

    /**
     * The row as a zone of its organization; null for a row without an organization, a rule or a limit, with half
     * a range or a bearing outside 0–360, or that is not a polygon.
     */
    static SpeedZones.Zone zone(Row row) {
        if (row.clientId() == null || row.clientId().isBlank() || row.shape() == null) {
            return null;
        }
        SpeedZones.Limits limits;
        if (row.singleLimit()) {
            limits = new SpeedZones.Limits(row.backward() != null ? row.backward() : row.forward(), null, null, null,
                    row.azimuth());
        } else if (bearing(row.forwardFrom()) && bearing(row.forwardTo())) {
            limits = new SpeedZones.Limits(row.forward(), row.backward(), row.forwardFrom(), row.forwardTo(),
                    row.azimuth());
        } else {
            return null;
        }
        if (limits.forward() == null && limits.backward() == null) {
            return null;
        }
        return SpeedZones.zone(row.clientId(), row.id(), limits, row.shape(), row.name());
    }

    private static boolean bearing(Integer deg) {
        return deg != null && deg >= 0 && deg <= 360;
    }
}
