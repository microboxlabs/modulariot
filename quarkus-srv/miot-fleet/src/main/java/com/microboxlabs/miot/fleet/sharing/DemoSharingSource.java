package com.microboxlabs.miot.fleet.sharing;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Fixed organizations with generated assets, for local development: a provider with thousands of devices, two
 * smaller providers, carriers and operators. The same seed gives the same assets on every start.
 */
public class DemoSharingSource implements SharingSource {

    private static final String LETTERS = "BCDFGHJKLPRSTVWXYZ";
    private static final List<String> KINDS = List.of("Tracto", "Jaula", "Señuelo", "Rampla", "Camión 3/4");

    private static final String ANDES = "Transportes Andes";
    private static final String PACIFICO = "Transportes Pacífico";
    private static final String NORTE = "Logística Norte";
    private static final List<String> OWNERS = List.of(ANDES, PACIFICO, "Fletes del Sur", "Carga Norte", NORTE,
            "Camiones Cordillera", "Transportes Litoral", "Rutas del Valle", "Transportes Atacama",
            "Fletes Patagonia", "Carga Express Centro", "Transportes Bío Bío", "");

    private static final String GPS_AUSTRAL = "gps-austral";
    private static final String RASTREO_SUR = "rastreo-sur";
    private static final String SATELITAL = "satelital-andina";
    private static final String TR_ANDES = "transportes-andes";
    private static final String TR_PACIFICO = "transportes-pacifico";
    private static final String LOG_NORTE = "logistica-norte";
    private static final String OP_CENTRAL = "operador-central";
    private static final String MINERA = "minera-altiplano";

    private static final String PLATFORM_OWNER = "plataforma@example.com";
    private static final long MAX_AGE_SECONDS = Duration.ofDays(20).toSeconds();

    private record Spec(String slug, String name, int count, List<String> owners, boolean operator) {
    }

    private static final List<Spec> SPECS = List.of(
            new Spec(GPS_AUSTRAL, "GPS Austral", 4812, OWNERS, false),
            new Spec(RASTREO_SUR, "Rastreo Sur", 1240, OWNERS.subList(4, OWNERS.size()), false),
            new Spec(SATELITAL, "Satelital Andina", 318, OWNERS.subList(0, 5), false),
            new Spec(TR_ANDES, ANDES, 22, List.of(ANDES), false),
            new Spec(TR_PACIFICO, PACIFICO, 15, List.of(PACIFICO), false),
            new Spec(LOG_NORTE, NORTE, 9, List.of(NORTE), true),
            new Spec(OP_CENTRAL, "Operador Central", 0, List.of(), true),
            new Spec(MINERA, "Minera Altiplano", 0, List.of(), true));

    /** A seeded share; the window is in days relative to now, {@code revokedDay} null when not revoked. */
    private record Seed(String source, String target, DataShare.Scope scope, ShareFilter filter, List<String> assetIds,
            DataShare.Origin origin, int fromDay, Integer toDay, String by, Integer revokedDay, String note) {
    }

    private final Map<String, List<SharingAsset>> assets = new HashMap<>();

    public DemoSharingSource(Instant now) {
        for (int i = 0; i < SPECS.size(); i++) {
            Spec spec = SPECS.get(i);
            assets.put(clientId(spec.slug()), generate(spec, new Random(i + 7L), now));
        }
    }

    public static String clientId(String slug) {
        return "demo-" + slug;
    }

    @Override
    public List<SharingOrg.Ref> organizations() {
        return SPECS.stream().map(s -> new SharingOrg.Ref(s.slug(), s.name(), clientId(s.slug()))).toList();
    }

    @Override
    public Map<String, Integer> assetCounts(Set<String> clientIds) {
        return clientIds.stream().filter(id -> !assets.getOrDefault(id, List.of()).isEmpty())
                .collect(Collectors.toMap(id -> id, id -> assets.get(id).size()));
    }

    @Override
    public Set<String> operators(Set<String> clientIds) {
        return SPECS.stream().filter(Spec::operator).map(s -> clientId(s.slug())).filter(clientIds::contains)
                .collect(Collectors.toSet());
    }

    @Override
    public List<SharingAsset> assets(String clientId) {
        return assets.getOrDefault(clientId, List.of());
    }

    /** A few shares in every status, relative to {@code now}. */
    public List<DataShare> seedShares(Instant now) {
        List<String> rastreo = ids(RASTREO_SUR);
        List<String> pacifico = ids(TR_PACIFICO);
        ShareFilter none = ShareFilter.NONE;
        List<Seed> seeds = List.of(
                new Seed(GPS_AUSTRAL, LOG_NORTE, DataShare.Scope.FILTER,
                        new ShareFilter(List.of(NORTE, "Carga Norte"), List.of()), List.of(), DataShare.Origin.MANUAL,
                        -120, null, PLATFORM_OWNER, null,
                        "Equipos de los transportistas que trabajan para Logística Norte."),
                new Seed(RASTREO_SUR, OP_CENTRAL, DataShare.Scope.ASSETS, none, rastreo.subList(0, 340),
                        DataShare.Origin.MANUAL, -30, 20, PLATFORM_OWNER, null, "Piloto de monitoreo por 50 días."),
                new Seed(TR_ANDES, OP_CENTRAL, DataShare.Scope.ALL, none, List.of(), DataShare.Origin.ACCREDITATION,
                        -60, 305, "Integración de acreditación", null, null),
                new Seed(TR_PACIFICO, LOG_NORTE, DataShare.Scope.ASSETS, none, pacifico.subList(0, 3),
                        DataShare.Origin.TRIP, -2, 5, "Integración de viajes", null, null),
                new Seed(GPS_AUSTRAL, OP_CENTRAL, DataShare.Scope.ALL, none, List.of(), DataShare.Origin.MANUAL,
                        -200, -10, PLATFORM_OWNER, null, null),
                new Seed(RASTREO_SUR, LOG_NORTE, DataShare.Scope.ASSETS, none, rastreo.subList(400, 412),
                        DataShare.Origin.MANUAL, -40, null, PLATFORM_OWNER, -5, "El transportista cambió de operador."),
                new Seed(SATELITAL, MINERA, DataShare.Scope.FILTER, new ShareFilter(List.of(), List.of("Tracto")),
                        List.of(), DataShare.Origin.MANUAL, 7, 97, PLATFORM_OWNER, null, null));
        return seeds.stream().map(s -> share(s, now)).toList();
    }

    private List<String> ids(String slug) {
        return assets(clientId(slug)).stream().map(SharingAsset::id).toList();
    }

    private static DataShare share(Seed s, Instant now) {
        Instant from = day(now, s.fromDay());
        Instant to = s.toDay() == null ? null : day(now, s.toDay());
        Instant revokedAt = s.revokedDay() == null ? null : day(now, s.revokedDay());
        return new DataShare(UUID.nameUUIDFromBytes((s.source() + s.target() + s.fromDay()).getBytes()), s.source(),
                s.target(), s.scope(), s.filter(), s.assetIds(), s.origin(), from, to, s.note(), s.by(), from,
                revokedAt, revokedAt == null ? null : s.by());
    }

    private static Instant day(Instant now, int offset) {
        return now.plus(Duration.ofDays(offset));
    }

    private static List<SharingAsset> generate(Spec spec, Random random, Instant now) {
        Set<String> seen = new HashSet<>();
        List<SharingAsset> list = new ArrayList<>();
        while (list.size() < spec.count()) {
            String id = id(random);
            if (seen.add(id)) {
                // The smaller of two draws: most assets reported recently, a few days ago.
                long age = Math.min(random.nextLong(MAX_AGE_SECONDS), random.nextLong(MAX_AGE_SECONDS));
                list.add(new SharingAsset(id, pick(KINDS, random), pick(spec.owners(), random),
                        now.minusSeconds(age)));
            }
        }
        list.sort(Comparator.comparing(SharingAsset::id));
        return list;
    }

    private static String id(Random random) {
        if (random.nextInt(100) < 12) {
            return "86%013d".formatted(random.nextLong(10_000_000_000_000L));
        }
        StringBuilder id = new StringBuilder();
        for (int i = 0; i < 4; i++) {
            id.append(LETTERS.charAt(random.nextInt(LETTERS.length())));
        }
        return id.append("%02d".formatted(random.nextInt(100))).toString();
    }

    /** The first values come up more often: the smaller of two draws. */
    private static String pick(List<String> values, Random random) {
        return values.get(Math.min(random.nextInt(values.size()), random.nextInt(values.size())));
    }
}
