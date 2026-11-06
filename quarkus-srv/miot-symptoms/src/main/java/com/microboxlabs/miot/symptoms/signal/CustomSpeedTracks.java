package com.microboxlabs.miot.symptoms.signal;

import io.smallrye.config.ConfigMapping;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * One organization's own speed polygons in the legacy speed database, read as {@link SpeedZones}. The table's
 * columns: {@code id}, {@code client} (a site code), {@code geom}, {@code speed_forward}, {@code speed_backward},
 * {@code azimuth_degree} and {@code order}. The legacy speed function picks forward or backward with rules
 * hard-coded per site; here each site's rule is configuration:
 *
 * <table>
 * <caption>Site rules</caption>
 * <tr><th>Legacy</th><th>{@code sites."<code>"}</th><th>Zone</th></tr>
 * <tr><td>Forward when the bearing of travel is in a range, else backward</td><td>{@code <from>-<to>}, degrees,
 * wrapping past 360 ({@code 270-90})</td><td>{@code forwardFrom}/{@code forwardTo}; without a bearing the
 * vehicle's last bearing is used, where the legacy compared {@code order} with the previous signal's</td></tr>
 * <tr><td>One limit, {@code coalesce(speed_backward, speed_forward)}</td><td>{@code one-limit}</td><td>that
 * limit</td></tr>
 * <tr><td>By {@code order} only</td><td>not set</td><td>not loaded</td></tr>
 * </table>
 *
 * <p>{@code azimuth_degree} is the zone's heading filter. Every zone belongs to {@code tenant}.
 */
final class CustomSpeedTracks {

    @ConfigMapping(prefix = "miot.symptoms.speed.custom-tracks")
    public interface Settings {
        /** The organization (GPS client id) the polygons belong to. No polygons without it. */
        Optional<String> tenant();

        /** The table, optionally schema-qualified. No polygons without it. */
        Optional<String> table();

        /**
         * Site code, ignoring case, to rule: {@code <from>-<to>} or {@code one-limit}. A site without a rule is not
         * loaded.
         */
        Map<String, String> sites();
    }

    sealed interface Rule {
    }

    /** Forward when the bearing of travel is within {@code [from, to]}. */
    record Forward(int from, int to) implements Rule {
    }

    record OneLimit() implements Rule {
    }

    /** One table row. */
    record Row(int id, String site, Integer forward, Integer backward, Integer azimuth, String shape) {
    }

    private static final Pattern RANGE = Pattern.compile("\\s*(\\d{1,3})\\s*-\\s*(\\d{1,3})\\s*");
    private static final Pattern TABLE = Pattern.compile("[A-Za-z_]\\w*(\\.[A-Za-z_]\\w*)?");

    static final String SQL = """
            SELECT id, client, speed_forward, speed_backward, azimuth_degree, ST_AsGeoJSON(geom) AS shape
              FROM %s WHERE geom IS NOT NULL
            """;

    private CustomSpeedTracks() {
    }

    static String sql(String table) {
        if (!TABLE.matcher(table).matches()) {
            throw new IllegalArgumentException("Invalid custom speed tracks table name");
        }
        return SQL.formatted(table);
    }

    static Map<String, Rule> rules(Map<String, String> sites) {
        Map<String, Rule> rules = new HashMap<>();
        sites.forEach((site, value) -> rules.put(site.toLowerCase(java.util.Locale.ROOT), rule(value)));
        return Map.copyOf(rules);
    }

    static Rule rule(String value) {
        if ("one-limit".equals(value.strip())) {
            return new OneLimit();
        }
        Matcher m = RANGE.matcher(value);
        if (m.matches()) {
            int from = Integer.parseInt(m.group(1));
            int to = Integer.parseInt(m.group(2));
            if (from <= 360 && to <= 360) {
                return new Forward(from, to);
            }
        }
        throw new IllegalArgumentException("A custom speed track site rule is <from>-<to> or one-limit: " + value);
    }

    /** The row as a zone of the tenant; null for a site without a rule, a row without a limit, or a non-polygon. */
    static SpeedZones.Zone zone(String tenant, Row row, Map<String, Rule> rules) {
        Rule rule = row.site() == null ? null : rules.get(row.site().toLowerCase(java.util.Locale.ROOT));
        if (rule == null || row.shape() == null) {
            return null;
        }
        SpeedZones.Limits limits = switch (rule) {
            case Forward f -> new SpeedZones.Limits(row.forward(), row.backward(), f.from(), f.to(), row.azimuth());
            case OneLimit o -> new SpeedZones.Limits(row.backward() != null ? row.backward() : row.forward(), null,
                    null, null, row.azimuth());
        };
        if (limits.forward() == null && limits.backward() == null) {
            return null;
        }
        return SpeedZones.zone(tenant, row.id(), limits, row.shape());
    }
}
