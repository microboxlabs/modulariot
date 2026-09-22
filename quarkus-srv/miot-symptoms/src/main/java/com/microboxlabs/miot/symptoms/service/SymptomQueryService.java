package com.microboxlabs.miot.symptoms.service;

import com.microboxlabs.miot.symptoms.domain.IcuSummary;
import com.microboxlabs.miot.symptoms.domain.LegacyTreatment;
import com.microboxlabs.miot.symptoms.domain.SymptomSummary;
import com.microboxlabs.miot.symptoms.dto.PageResult;
import com.microboxlabs.miot.symptoms.dto.SymptomFilter;
import com.microboxlabs.miot.symptoms.process.SymptomsGpsQuery;
import io.vertx.core.json.JsonObject;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.RowSet;
import io.vertx.mutiny.sqlclient.Tuple;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Tenant-scoped reads over StreamHub {@code public.symptoms}. These are the
 * module's own statements, not the {@code api_modular_*} functions the previous
 * UI called through pgREST: those functions hardcode one tenant's client id, so
 * they cannot serve a multi-tenant API. Every statement filters on the
 * tenant's symptoms client id first.
 */
@ApplicationScoped
public class SymptomQueryService {

    public static final int MAX_PAGE_SIZE = 200;

    private static final String SYMPTOM_SELECT = """
            SELECT s.id, s.asset_id, s.trip_id, s.symptom_name, s.symptom_type, s.icu_code,
                   s.first_signal_timestamp, s.last_signal_timestamp, s.finished_at, s.is_active, s.with_trip,
                   s.accumulated_value, s.accumulated_signals,
                   lt.driver_name, lt.trip_type,
                   COALESCE(tr.treatment_count, 0) AS treatment_count, tr.last_assigned_to
            FROM public.symptoms s
            LEFT JOIN public.live_trip lt ON lt.trip_id = s.trip_id AND lt.asset_id = s.asset_id
            LEFT JOIN LATERAL (
                SELECT COUNT(*) AS treatment_count,
                       (ARRAY_AGG(t.assigned_to ORDER BY t.created_at DESC))[1] AS last_assigned_to
                FROM public.treatments t
                JOIN public.symptom_treatments st ON st.treatment_id = t.id
                WHERE st.symptom_id = s.id AND t.status IN ('active', 'pending')
            ) tr ON TRUE
            """;

    private static final String LIST_WHERE = """
            WHERE s.client_id = $1 AND s.excluded = false
              AND ($2::integer IS NULL OR s.icu_code = $2)
              AND ($3::text IS NULL OR s.asset_id = $3)
              AND ($4::text IS NULL OR s.trip_id = $4)
              AND ($5::text IS NULL OR s.symptom_name = $5)
              AND ($6::boolean IS NULL OR s.is_active = $6)
              AND ($7::timestamptz IS NULL OR s.first_signal_timestamp >= $7)
              AND ($8::timestamptz IS NULL OR s.first_signal_timestamp < $8)
            """;

    private static final String LIST = SYMPTOM_SELECT + LIST_WHERE
            + "ORDER BY s.first_signal_timestamp DESC LIMIT $9 OFFSET $10";

    private static final String COUNT = "SELECT COUNT(*) AS total FROM public.symptoms s " + LIST_WHERE;

    private static final String GET = SYMPTOM_SELECT + "WHERE s.client_id = $1 AND s.id = $2";

    private static final String ICU_SUMMARY = """
            SELECT CASE WHEN COALESCE(tr.treatment_count, 0) > 0 THEN 6 ELSE s.icu_code END AS bucket,
                   COUNT(*) AS total
            FROM public.symptoms s
            LEFT JOIN public.live_trip lt ON lt.trip_id = s.trip_id AND lt.asset_id = s.asset_id
            LEFT JOIN LATERAL (
                SELECT COUNT(*) AS treatment_count
                FROM public.treatments t
                JOIN public.symptom_treatments st ON st.treatment_id = t.id
                WHERE st.symptom_id = s.id AND t.status IN ('active', 'pending')
            ) tr ON TRUE
            WHERE s.client_id = $1 AND s.is_active AND s.excluded = false
              AND (s.with_trip = false OR lt.trip_id IS NOT NULL)
              AND LOWER(COALESCE(lt.trip_type, 'v')) NOT IN ('ote', 'otr')
            GROUP BY 1""";

    private static final String LEGACY_TREATMENTS = """
            SELECT t.id, t.treatment_type, t.status, t.assigned_to, t.description, t.created_at, t.updated_at,
                   t.symptom_treatment_time
            FROM public.treatments t
            JOIN public.symptom_treatments st ON st.treatment_id = t.id
            WHERE t.client_id = $1 AND st.symptom_id = $2
            ORDER BY t.created_at""";

    private final SymptomsGpsQuery gps;
    private final SymptomsTenantResolver tenants;

    @Inject
    public SymptomQueryService(SymptomsGpsQuery gps, SymptomsTenantResolver tenants) {
        this.gps = gps;
        this.tenants = tenants;
    }

    public PageResult<SymptomSummary> list(String tenantCode, SymptomFilter f, int page, int pageSize) {
        if (page < 1) {
            throw new IllegalArgumentException("page must be >= 1");
        }
        if (pageSize < 1 || pageSize > MAX_PAGE_SIZE) {
            throw new IllegalArgumentException("pageSize must be between 1 and " + MAX_PAGE_SIZE);
        }
        if (f.from() != null && f.to() != null && !f.from().isBefore(f.to())) {
            throw new IllegalArgumentException("from must be before to");
        }
        String clientId = tenants.symptomsClientId(tenantCode);
        Tuple where = Tuple.tuple()
                .addString(clientId)
                .addInteger(f.icuCode())
                .addString(blankToNull(f.assetId()))
                .addString(blankToNull(f.tripId()))
                .addString(blankToNull(f.symptomName()))
                .addBoolean(f.active())
                .addOffsetDateTime(f.from())
                .addOffsetDateTime(f.to());
        Tuple listParams = Tuple.tuple();
        for (int i = 0; i < where.size(); i++) {
            listParams.addValue(where.getValue(i));
        }
        listParams.addInteger(pageSize).addInteger((page - 1) * pageSize);

        RowSet<Row> rows = gps.query(LIST, listParams).await().indefinitely();
        List<SymptomSummary> items = new ArrayList<>();
        rows.forEach(row -> items.add(mapSymptom(row)));
        RowSet<Row> count = gps.query(COUNT, where).await().indefinitely();
        long total = count.iterator().hasNext() ? count.iterator().next().getLong("total") : items.size();
        return new PageResult<>(items, total, page, pageSize);
    }

    public Optional<SymptomSummary> get(String tenantCode, long symptomId) {
        String clientId = tenants.symptomsClientId(tenantCode);
        RowSet<Row> rows = gps.query(GET, Tuple.of(clientId, symptomId)).await().indefinitely();
        return rows.iterator().hasNext() ? Optional.of(mapSymptom(rows.iterator().next())) : Optional.empty();
    }

    public IcuSummary icuSummary(String tenantCode) {
        String clientId = tenants.symptomsClientId(tenantCode);
        RowSet<Row> rows = gps.query(ICU_SUMMARY, Tuple.of(clientId)).await().indefinitely();
        Map<Integer, Long> buckets = new LinkedHashMap<>();
        rows.forEach(row -> {
            Integer bucket = row.getInteger("bucket");
            if (bucket != null) {
                buckets.put(bucket, row.getLong("total"));
            }
        });
        return new IcuSummary(
                buckets.getOrDefault(1, 0L),
                buckets.getOrDefault(2, 0L),
                buckets.getOrDefault(3, 0L),
                buckets.getOrDefault(4, 0L),
                buckets.getOrDefault(6, 0L));
    }

    public List<LegacyTreatment> legacyTreatments(String tenantCode, long symptomId) {
        String clientId = tenants.symptomsClientId(tenantCode);
        RowSet<Row> rows = gps.query(LEGACY_TREATMENTS, Tuple.of(clientId, symptomId)).await().indefinitely();
        List<LegacyTreatment> out = new ArrayList<>();
        rows.forEach(row -> {
            Object description = row.getValue("description");
            out.add(new LegacyTreatment(
                    row.getLong("id"),
                    row.getString("treatment_type"),
                    row.getString("status"),
                    row.getString("assigned_to"),
                    description instanceof JsonObject json ? new LinkedHashMap<>(json.getMap()) : Map.of(),
                    row.getOffsetDateTime("created_at"),
                    row.getOffsetDateTime("updated_at"),
                    row.getInteger("symptom_treatment_time")));
        });
        return out;
    }

    static SymptomSummary mapSymptom(Row row) {
        Integer icu = row.getInteger("icu_code");
        long treatmentCount = row.getLong("treatment_count");
        return new SymptomSummary(
                row.getLong("id"),
                row.getString("asset_id"),
                row.getString("trip_id"),
                row.getString("symptom_name"),
                row.getString("symptom_type"),
                icu,
                icuCondition(icu, treatmentCount),
                row.getOffsetDateTime("first_signal_timestamp"),
                row.getOffsetDateTime("last_signal_timestamp"),
                row.getOffsetDateTime("finished_at"),
                Boolean.TRUE.equals(row.getBoolean("is_active")),
                Boolean.TRUE.equals(row.getBoolean("with_trip")),
                row.getDouble("accumulated_value"),
                row.getInteger("accumulated_signals"),
                row.getString("driver_name"),
                row.getString("trip_type"),
                treatmentCount,
                row.getString("last_assigned_to"));
    }

    /** Same labels the tower cards use; "Under Treatment" wins over the ICU code, as in the legacy views. */
    static String icuCondition(Integer icuCode, long openTreatments) {
        if (openTreatments > 0) {
            return "Under Treatment";
        }
        if (icuCode == null) {
            return null;
        }
        return switch (icuCode) {
            case 1 -> "Under Observation";
            case 2 -> "Compromised condition";
            case 3 -> "Critical condition";
            case 4 -> "Code Black";
            default -> null;
        };
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }
}
