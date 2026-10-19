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

/**
 * Fixed organizations with generated assets, for local development: a provider with thousands of devices, two
 * smaller providers, carriers and operators. The same seed gives the same assets on every start.
 */
public class DemoSharingSource implements SharingSource {

    private static final String LETTERS = "BCDFGHJKLPRSTVWXYZ";
    private static final List<String> KINDS = List.of("Tracto", "Jaula", "Señuelo", "Rampla", "Camión 3/4");
    private static final List<String> OWNERS = List.of("Transportes Andes", "Transportes Pacífico",
            "Fletes del Sur", "Carga Norte", "Logística Norte", "Camiones Cordillera", "Transportes Litoral",
            "Rutas del Valle", "Transportes Atacama", "Fletes Patagonia", "Carga Express Centro",
            "Transportes Bío Bío", "");

    private record Spec(String slug, String name, int count, List<String> owners, boolean operator) {
    }

    private static final List<Spec> SPECS = List.of(
            new Spec("gps-austral", "GPS Austral", 4812, OWNERS, false),
            new Spec("rastreo-sur", "Rastreo Sur", 1240, OWNERS.subList(4, OWNERS.size()), false),
            new Spec("satelital-andina", "Satelital Andina", 318, OWNERS.subList(0, 5), false),
            new Spec("transportes-andes", "Transportes Andes", 22, List.of("Transportes Andes"), false),
            new Spec("transportes-pacifico", "Transportes Pacífico", 15, List.of("Transportes Pacífico"), false),
            new Spec("logistica-norte", "Logística Norte", 9, List.of("Logística Norte"), true),
            new Spec("operador-central", "Operador Central", 0, List.of(), true),
            new Spec("minera-altiplano", "Minera Altiplano", 0, List.of(), true));

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
        Map<String, Integer> counts = new HashMap<>();
        for (String id : clientIds) {
            List<SharingAsset> list = assets.get(id);
            if (list != null && !list.isEmpty()) {
                counts.put(id, list.size());
            }
        }
        return counts;
    }

    @Override
    public Set<String> operators(Set<String> clientIds) {
        Set<String> found = new HashSet<>();
        for (Spec spec : SPECS) {
            if (spec.operator() && clientIds.contains(clientId(spec.slug()))) {
                found.add(clientId(spec.slug()));
            }
        }
        return found;
    }

    @Override
    public List<SharingAsset> assets(String clientId) {
        return assets.getOrDefault(clientId, List.of());
    }

    /** A few shares in every status, relative to {@code now}. */
    public List<DataShare> seedShares(Instant now) {
        String owner = "plataforma@example.com";
        List<String> rastreo = assets(clientId("rastreo-sur")).stream().map(SharingAsset::id).toList();
        List<String> pacifico = assets(clientId("transportes-pacifico")).stream().map(SharingAsset::id).toList();
        return List.of(
                share("gps-austral", "logistica-norte", DataShare.Scope.FILTER,
                        new ShareFilter(List.of("Logística Norte", "Carga Norte"), List.of()), List.of(),
                        DataShare.Origin.MANUAL, day(now, -120), null, owner, null,
                        "Equipos de los transportistas que trabajan para Logística Norte."),
                share("rastreo-sur", "operador-central", DataShare.Scope.ASSETS, ShareFilter.NONE,
                        rastreo.subList(0, 340), DataShare.Origin.MANUAL, day(now, -30), day(now, 20), owner, null,
                        "Piloto de monitoreo por 50 días."),
                share("transportes-andes", "operador-central", DataShare.Scope.ALL, ShareFilter.NONE, List.of(),
                        DataShare.Origin.ACCREDITATION, day(now, -60), day(now, 305), "Integración de acreditación",
                        null, null),
                share("transportes-pacifico", "logistica-norte", DataShare.Scope.ASSETS, ShareFilter.NONE,
                        pacifico.subList(0, 3), DataShare.Origin.TRIP, day(now, -2), day(now, 5),
                        "Integración de viajes", null, null),
                share("gps-austral", "operador-central", DataShare.Scope.ALL, ShareFilter.NONE, List.of(),
                        DataShare.Origin.MANUAL, day(now, -200), day(now, -10), owner, null, null),
                share("rastreo-sur", "logistica-norte", DataShare.Scope.ASSETS, ShareFilter.NONE,
                        rastreo.subList(400, 412), DataShare.Origin.MANUAL, day(now, -40), null, owner,
                        day(now, -5), "El transportista cambió de operador."),
                share("satelital-andina", "minera-altiplano", DataShare.Scope.FILTER,
                        new ShareFilter(List.of(), List.of("Tracto")), List.of(), DataShare.Origin.MANUAL,
                        day(now, 7), day(now, 97), owner, null, null));
    }

    private static DataShare share(String source, String target, DataShare.Scope scope, ShareFilter filter,
            List<String> assetIds, DataShare.Origin origin, Instant from, Instant to, String by, Instant revokedAt,
            String note) {
        return new DataShare(UUID.nameUUIDFromBytes((source + target + from).getBytes()), source, target, scope,
                filter, assetIds, origin, from, to, note, by, from, revokedAt, revokedAt == null ? null : by);
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
                long ageSeconds = (long) (Math.pow(random.nextDouble(), 3) * Duration.ofDays(20).toSeconds());
                list.add(new SharingAsset(id, pick(KINDS, random, 1.8), pick(spec.owners(), random, 1.4),
                        now.minusSeconds(ageSeconds)));
            }
        }
        list.sort(Comparator.comparing(SharingAsset::id));
        return list;
    }

    private static String id(Random random) {
        if (random.nextDouble() < 0.12) {
            return "86%013d".formatted((long) (random.nextDouble() * 1e13));
        }
        StringBuilder id = new StringBuilder();
        for (int i = 0; i < 4; i++) {
            id.append(LETTERS.charAt(random.nextInt(LETTERS.length())));
        }
        return id.append("%02d".formatted(random.nextInt(100))).toString();
    }

    private static String pick(List<String> values, Random random, double skew) {
        return values.get((int) (Math.pow(random.nextDouble(), skew) * values.size()));
    }
}
