package com.microboxlabs.miot.core.selectable;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.agroal.api.AgroalDataSource;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import javax.sql.DataSource;

/**
 * Lists and bindings in {@code miot_core}, so they survive a restart and every
 * replica sees the same ones. Blocking JDBC: the service is called from the
 * worker pool.
 */
@ApplicationScoped
public class JdbcSelectableStore implements SelectableStore {

    private static final String FOREIGN_KEY_VIOLATION = "23503";
    private static final String COLUMNS = "tenant_code, key, name, description, mode, settings, groups, source,"
            + " options, updated_by, updated_at";
    private static final String UPSERT = "INSERT INTO miot_core.selectables (" + COLUMNS + ")"
            + " VALUES (?, ?, ?::jsonb, ?::jsonb, ?, ?::jsonb, ?::jsonb, ?::jsonb, ?::jsonb, ?, now())"
            + " ON CONFLICT (tenant_code, key) DO UPDATE SET name = EXCLUDED.name,"
            + " description = EXCLUDED.description, mode = EXCLUDED.mode, settings = EXCLUDED.settings,"
            + " groups = EXCLUDED.groups, source = EXCLUDED.source, options = EXCLUDED.options,"
            + " updated_by = EXCLUDED.updated_by, updated_at = EXCLUDED.updated_at"
            + " RETURNING " + COLUMNS;
    private static final String MARK_SEEDED =
            "INSERT INTO miot_core.selectable_tenants (tenant_code) VALUES (?) ON CONFLICT DO NOTHING";
    private static final TypeReference<Map<String, String>> TEXTS = new TypeReference<>() {
    };
    private static final TypeReference<List<SelectableGroup>> GROUPS = new TypeReference<>() {
    };
    private static final TypeReference<List<SelectableOption>> OPTIONS = new TypeReference<>() {
    };

    private final DataSource dataSource;
    private final ObjectMapper json;

    @Inject
    public JdbcSelectableStore(AgroalDataSource dataSource, ObjectMapper json) {
        this((DataSource) dataSource, json);
    }

    JdbcSelectableStore(DataSource dataSource, ObjectMapper json) {
        this.dataSource = dataSource;
        this.json = json;
    }

    @Override
    public List<Selectable> list(String tenantCode) {
        return withConnection(c -> {
            try (PreparedStatement st = c.prepareStatement(
                    "SELECT " + COLUMNS + " FROM miot_core.selectables WHERE tenant_code = ? ORDER BY id")) {
                st.setString(1, tenantCode);
                return readAll(st);
            }
        });
    }

    @Override
    public Optional<Selectable> find(String tenantCode, String key) {
        return withConnection(c -> {
            try (PreparedStatement st = c.prepareStatement(
                    "SELECT " + COLUMNS + " FROM miot_core.selectables WHERE tenant_code = ? AND key = ?")) {
                st.setString(1, tenantCode);
                st.setString(2, key);
                return readAll(st).stream().findFirst();
            }
        });
    }

    @Override
    public Selectable upsert(Selectable selectable) {
        return withConnection(c -> upsert(c, selectable));
    }

    @Override
    public boolean delete(String tenantCode, String key) {
        return withConnection(c -> {
            try (PreparedStatement st = c.prepareStatement(
                    "DELETE FROM miot_core.selectables WHERE tenant_code = ? AND key = ?")) {
                st.setString(1, tenantCode);
                st.setString(2, key);
                return st.executeUpdate() > 0;
            }
        });
    }

    @Override
    public Map<String, String> bindings(String tenantCode) {
        return withConnection(c -> {
            try (PreparedStatement st = c.prepareStatement("SELECT field_key, selectable_key"
                    + " FROM miot_core.selectable_bindings WHERE tenant_code = ? ORDER BY field_key")) {
                st.setString(1, tenantCode);
                Map<String, String> out = new LinkedHashMap<>();
                try (ResultSet rs = st.executeQuery()) {
                    while (rs.next()) {
                        out.put(rs.getString(1), rs.getString(2));
                    }
                }
                return out;
            }
        });
    }

    /** The foreign key turns a binding to a missing list, even one deleted by another replica, into a 400. */
    @Override
    public void bindAll(String tenantCode, Map<String, String> fieldToSelectable) {
        inTransaction(c -> {
            try (PreparedStatement st = c.prepareStatement("INSERT INTO miot_core.selectable_bindings"
                    + " (tenant_code, field_key, selectable_key) VALUES (?, ?, ?)"
                    + " ON CONFLICT (tenant_code, field_key) DO UPDATE SET selectable_key = EXCLUDED.selectable_key")) {
                st.setString(1, tenantCode);
                for (Map.Entry<String, String> e : fieldToSelectable.entrySet()) {
                    st.setString(2, e.getKey());
                    st.setString(3, e.getValue());
                    try {
                        st.executeUpdate();
                    } catch (SQLException ex) {
                        if (FOREIGN_KEY_VIOLATION.equals(ex.getSQLState())) {
                            throw new IllegalArgumentException("unknown selectable: " + e.getValue(), ex);
                        }
                        throw ex;
                    }
                }
            }
            return null;
        });
    }

    @Override
    public boolean isSeeded(String tenantCode) {
        return withConnection(c -> {
            try (PreparedStatement st = c.prepareStatement(
                    "SELECT 1 FROM miot_core.selectable_tenants WHERE tenant_code = ?")) {
                st.setString(1, tenantCode);
                try (ResultSet rs = st.executeQuery()) {
                    return rs.next();
                }
            }
        });
    }

    /** A replica seeding the same tenant at the same time waits on the marker row, then writes nothing. */
    @Override
    public void seed(String tenantCode, List<Selectable> defaults) {
        inTransaction(c -> {
            if (markSeeded(c, tenantCode)) {
                for (Selectable s : defaults) {
                    upsert(c, s);
                }
            }
            return null;
        });
    }

    @Override
    public void resetTo(String tenantCode, List<Selectable> lists) {
        inTransaction(c -> {
            try (PreparedStatement st = c.prepareStatement(
                    "DELETE FROM miot_core.selectables WHERE tenant_code = ?")) {
                st.setString(1, tenantCode);
                st.executeUpdate();
            }
            for (Selectable s : lists) {
                upsert(c, s);
            }
            markSeeded(c, tenantCode);
            return null;
        });
    }

    private static boolean markSeeded(Connection c, String tenantCode) throws SQLException {
        try (PreparedStatement st = c.prepareStatement(MARK_SEEDED)) {
            st.setString(1, tenantCode);
            return st.executeUpdate() > 0;
        }
    }

    private Selectable upsert(Connection c, Selectable s) throws SQLException {
        try (PreparedStatement st = c.prepareStatement(UPSERT)) {
            st.setString(1, s.tenantCode());
            st.setString(2, s.key());
            st.setString(3, write(s.name() == null ? Map.of() : s.name()));
            st.setString(4, write(s.description() == null ? Map.of() : s.description()));
            st.setString(5, s.mode().name());
            st.setString(6, write(s.settings() == null ? SelectableSettings.DEFAULT : s.settings()));
            st.setString(7, write(s.groups() == null ? List.of() : s.groups()));
            st.setString(8, write(s.source() == null ? SelectableSource.STATIC : s.source()));
            st.setString(9, write(s.options() == null ? List.of() : s.options()));
            st.setString(10, s.updatedBy());
            return readAll(st).get(0);
        }
    }

    private List<Selectable> readAll(PreparedStatement st) throws SQLException {
        List<Selectable> out = new ArrayList<>();
        try (ResultSet rs = st.executeQuery()) {
            while (rs.next()) {
                out.add(new Selectable(
                        rs.getString("tenant_code"),
                        rs.getString("key"),
                        read(rs.getString("name"), TEXTS),
                        read(rs.getString("description"), TEXTS),
                        SelectionMode.valueOf(rs.getString("mode")),
                        read(rs.getString("settings"), SelectableSettings.class),
                        List.copyOf(read(rs.getString("groups"), GROUPS)),
                        read(rs.getString("source"), SelectableSource.class),
                        List.copyOf(read(rs.getString("options"), OPTIONS)),
                        rs.getString("updated_by"),
                        rs.getObject("updated_at", OffsetDateTime.class)));
            }
        }
        return out;
    }

    private String write(Object value) {
        try {
            return json.writeValueAsString(value);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("could not write a selectable column", e);
        }
    }

    private <T> T read(String raw, TypeReference<T> type) {
        try {
            return json.readValue(raw, type);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("could not read a selectable column", e);
        }
    }

    private <T> T read(String raw, Class<T> type) {
        try {
            return json.readValue(raw, type);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("could not read a selectable column", e);
        }
    }

    @FunctionalInterface
    private interface Work<T> {
        T run(Connection c) throws SQLException;
    }

    private <T> T withConnection(Work<T> work) {
        try (Connection c = dataSource.getConnection()) {
            return work.run(c);
        } catch (SQLException e) {
            throw new IllegalStateException("selectables query failed", e);
        }
    }

    /** Commits when {@code work} returns; rolls back and rethrows otherwise. */
    private <T> T inTransaction(Work<T> work) {
        return withConnection(c -> {
            c.setAutoCommit(false);
            try {
                T result = work.run(c);
                c.commit();
                return result;
            } catch (SQLException | RuntimeException e) {
                c.rollback();
                throw e;
            } finally {
                c.setAutoCommit(true);
            }
        });
    }
}
