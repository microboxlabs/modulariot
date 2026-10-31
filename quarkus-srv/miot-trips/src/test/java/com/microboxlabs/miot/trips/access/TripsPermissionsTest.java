package com.microboxlabs.miot.trips.access;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.core.iam.AccessRegistry;
import com.microboxlabs.miot.core.iam.AccessRules;
import com.microboxlabs.miot.core.iam.BaseRole;
import com.microboxlabs.miot.core.iam.Caller;
import com.microboxlabs.miot.core.iam.CoreAccessCatalog;
import com.microboxlabs.miot.core.iam.OrgPermission;
import com.microboxlabs.miot.trips.api.OrgTripsAccessResource;
import com.microboxlabs.miot.trips.api.OrgTripsResource;
import com.microboxlabs.miot.trips.api.OrgMonitorsResource;
import io.quarkus.security.PermissionsAllowed;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.PATCH;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import java.io.IOException;
import java.lang.reflect.Method;
import java.lang.reflect.Modifier;
import java.net.URISyntaxException;
import java.nio.file.Files;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.TreeSet;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;

class TripsPermissionsTest {

    /** Every resource class in the api package; only the access endpoint needs no permission. */
    private static final List<Class<?>> RESOURCES = resources();

    private static final String VIEW = TripsAccessCatalog.VIEW;
    private static final String MANDATE_WRITE = TripsAccessCatalog.MANDATE_WRITE;
    private static final String CARGO_OPERATE = TripsAccessCatalog.CARGO_OPERATE;
    private static final String TRIP_WRITE = TripsAccessCatalog.TRIP_WRITE;
    private static final String MILESTONE_CONFIRM = TripsAccessCatalog.MILESTONE_CONFIRM;
    private static final String DELIVERY_OPERATE = TripsAccessCatalog.DELIVERY_OPERATE;
    private static final String DOCUMENT_MANAGE = TripsAccessCatalog.DOCUMENT_MANAGE;
    private static final String DOCUMENT_REVIEW = TripsAccessCatalog.DOCUMENT_REVIEW;
    private static final String STAGE_OPERATE = TripsAccessCatalog.STAGE_OPERATE;
    private static final String ASSIGNMENT_WRITE = TripsAccessCatalog.ASSIGNMENT_WRITE;
    private static final String LOCATION_WRITE = TripsAccessCatalog.LOCATION_WRITE;
    private static final String FEED_WRITE = TripsAccessCatalog.FEED_WRITE;
    private static final String FEED_ADMIN = TripsAccessCatalog.FEED_ADMIN;
    private static final String MONITOR_ADMIN = TripsAccessCatalog.MONITOR_ADMIN;

    /** Every endpoint and the permission it needs. A new endpoint without an entry here fails the test. */
    private static final Map<String, String> EXPECTED = new TreeMap<>(Map.ofEntries(
            Map.entry("OrgMandatesResource.list", VIEW),
            Map.entry("OrgMandatesResource.create", MANDATE_WRITE),
            Map.entry("OrgMandatesResource.get", VIEW),
            Map.entry("OrgMandatesResource.update", MANDATE_WRITE),
            Map.entry("OrgMandatesResource.close", MANDATE_WRITE),
            Map.entry("OrgMandatesResource.cancel", MANDATE_WRITE),
            Map.entry("OrgCargoResource.list", VIEW),
            Map.entry("OrgCargoResource.announce", CARGO_OPERATE),
            Map.entry("OrgCargoResource.update", CARGO_OPERATE),
            Map.entry("OrgCargoResource.receive", CARGO_OPERATE),
            Map.entry("OrgTripsResource.list", VIEW),
            Map.entry("OrgTripsResource.create", TRIP_WRITE),
            Map.entry("OrgTripsResource.get", VIEW),
            Map.entry("OrgTripsResource.geofences", VIEW),
            Map.entry("OrgTripsResource.update", TRIP_WRITE),
            Map.entry("OrgTripsResource.linkMandate", TRIP_WRITE),
            Map.entry("OrgTripsResource.unlinkMandate", TRIP_WRITE),
            Map.entry("OrgTripsResource.cancel", TRIP_WRITE),
            Map.entry("OrgStagesResource.list", VIEW),
            Map.entry("OrgStagesResource.add", TRIP_WRITE),
            Map.entry("OrgStagesResource.update", TRIP_WRITE),
            Map.entry("OrgStagesResource.start", STAGE_OPERATE),
            Map.entry("OrgStagesResource.close", STAGE_OPERATE),
            Map.entry("OrgActivitiesResource.list", VIEW),
            Map.entry("OrgActivitiesResource.add", STAGE_OPERATE),
            Map.entry("OrgActivitiesResource.update", STAGE_OPERATE),
            Map.entry("OrgActivitiesResource.complete", ASSIGNMENT_WRITE + " + " + STAGE_OPERATE),
            Map.entry("OrgAssignmentsResource.list", VIEW),
            Map.entry("OrgAssignmentsResource.create", ASSIGNMENT_WRITE),
            Map.entry("OrgAssignmentsResource.end", ASSIGNMENT_WRITE),
            Map.entry("OrgTripCargoResource.mount", TRIP_WRITE),
            Map.entry("OrgTripCargoResource.place", STAGE_OPERATE),
            Map.entry("OrgTripCargoResource.unmount", TRIP_WRITE),
            Map.entry("OrgLocationsResource.list", VIEW),
            Map.entry("OrgLocationsResource.create", LOCATION_WRITE),
            Map.entry("OrgLocationsResource.update", LOCATION_WRITE),
            Map.entry("OrgLocationsResource.linkGeofence", LOCATION_WRITE),
            Map.entry("OrgLocationsResource.geofences", VIEW),
            Map.entry("OrgLocationsResource.resolve", LOCATION_WRITE),
            Map.entry("OrgLocationsResource.place", LOCATION_WRITE),
            Map.entry("OrgLocationsResource.reject", LOCATION_WRITE),
            Map.entry("OrgTripsLiveResource.list", VIEW),
            Map.entry("OrgTripsLiveResource.get", VIEW),
            Map.entry("OrgTripsAuditResource.list", VIEW),
            Map.entry("OrgTripsBoardResource.counts", VIEW),
            Map.entry("OrgTripsBoardResource.events", VIEW),
            Map.entry("OrgTripsBoardResource.sheet", VIEW),
            Map.entry("OrgTripsBoardResource.view", VIEW),
            Map.entry("OrgFeedsResource.list", VIEW),
            Map.entry("OrgFeedsResource.save", FEED_ADMIN),
            Map.entry("OrgFeedsResource.create", FEED_ADMIN),
            Map.entry("OrgFeedsResource.batch", FEED_WRITE),
            Map.entry("OrgFeedsResource.reconcile", FEED_WRITE),
            Map.entry("OrgFeedsResource.get", VIEW),
            Map.entry("OrgMonitorsResource.list", VIEW),
            Map.entry("OrgMonitorsResource.schema", VIEW),
            Map.entry("OrgMonitorsResource.check", VIEW),
            Map.entry("OrgMonitorsResource.confirmers", VIEW),
            Map.entry("OrgMonitorsResource.get", VIEW),
            Map.entry("OrgMonitorsResource.save", MONITOR_ADMIN),
            Map.entry("OrgMonitorsResource.saveConfirmers", MONITOR_ADMIN),
            Map.entry("OrgMonitorsResource.discard", MONITOR_ADMIN),
            Map.entry("OrgMonitorsResource.publish", MONITOR_ADMIN),
            Map.entry("OrgMonitorsResource.version", VIEW),
            Map.entry("OrgMonitorsResource.scopeValues", VIEW),
            Map.entry("OrgMonitorsResource.checkScope", VIEW),
            Map.entry("OrgTripMonitorResource.get", VIEW),
            Map.entry("OrgTripDeliveriesResource.list", VIEW),
            Map.entry("OrgTripDeliveriesResource.content", VIEW),
            Map.entry("OrgTripDeliveriesResource.create", DELIVERY_OPERATE),
            Map.entry("OrgTripDeliveriesResource.link", DELIVERY_OPERATE),
            Map.entry("OrgTripDeliveriesResource.upload", DELIVERY_OPERATE),
            Map.entry("OrgTripDeliveriesResource.confirm", DELIVERY_OPERATE),
            Map.entry("OrgTripDeliveriesResource.reject", DELIVERY_OPERATE),
            Map.entry("OrgTripDocumentsResource.list", VIEW),
            Map.entry("OrgTripDocumentsResource.catalog", VIEW),
            Map.entry("OrgTripDocumentsResource.content", VIEW),
            Map.entry("OrgTripDocumentsResource.reviews", VIEW),
            Map.entry("OrgTripDocumentsResource.upload", DOCUMENT_MANAGE),
            Map.entry("OrgTripDocumentsResource.replace", DOCUMENT_MANAGE),
            Map.entry("OrgTripDocumentsResource.change", DOCUMENT_MANAGE),
            Map.entry("OrgTripDocumentsResource.delete", DOCUMENT_MANAGE),
            Map.entry("OrgTripDocumentsResource.review", DOCUMENT_REVIEW),
            Map.entry("OrgTripMilestonesResource.confirm", MILESTONE_CONFIRM),
            Map.entry("OrgTripMilestonesResource.detect", MILESTONE_CONFIRM),
            Map.entry("OrgTripMilestonesResource.list", VIEW),
            Map.entry("OrgTripMilestonesResource.pending", VIEW),
            Map.entry("OrgTripMilestonesResource.reject", MILESTONE_CONFIRM),
            Map.entry("OrgTripMonitorResource.bind", TRIP_WRITE),
            Map.entry("OrgTripMonitorResource.signal", STAGE_OPERATE),
            Map.entry("OrgTripMonitorResource.transitions", VIEW)));

    @Test
    void everyEndpointDeclaresItsOrganizationPermission() {
        Map<String, String> actual = new TreeMap<>();
        assertTrue(RESOURCES.size() >= 10, "resources found: " + RESOURCES);
        for (Class<?> resource : RESOURCES) {
            for (Method method : resource.getDeclaredMethods()) {
                if (!Modifier.isPublic(method.getModifiers()) || !isEndpoint(method)) {
                    continue;
                }
                PermissionsAllowed allowed = method.getAnnotation(PermissionsAllowed.class);
                String name = resource.getSimpleName() + "." + method.getName();
                assertNotNull(allowed, name + " has no @PermissionsAllowed");
                assertEquals(OrgPermission.class, allowed.permission(), name);
                assertArrayEquals(new String[] {"organizationId"}, allowed.params(), name);
                assertTrue(allowed.value().length == 1 || allowed.inclusive(),
                        name + " lists several permissions: it must require all of them");
                actual.put(name, String.join(" + ", new TreeSet<>(List.of(allowed.value()))));
            }
        }
        assertEquals(EXPECTED, actual);
    }

    @Test
    void eachRoleCanDoWhatItsNameSays() {
        AccessRegistry registry = new AccessRegistry(List.of(new CoreAccessCatalog(), new TripsAccessCatalog()));
        Set<String> viewer = grant(registry, TripsAccessCatalog.VIEWER);
        Set<String> operator = grant(registry, TripsAccessCatalog.OPERATOR);
        Set<String> maintainer = grant(registry, TripsAccessCatalog.MAINTAINER);

        assertTrue(viewer.contains(VIEW) && !viewer.contains(STAGE_OPERATE));
        assertTrue(operator.containsAll(Set.of(VIEW, STAGE_OPERATE, CARGO_OPERATE, ASSIGNMENT_WRITE,
                DELIVERY_OPERATE, DOCUMENT_MANAGE, DOCUMENT_REVIEW)));
        assertTrue(!operator.contains(MANDATE_WRITE) && !operator.contains(TRIP_WRITE));
        assertTrue(maintainer.containsAll(Set.of(VIEW, MANDATE_WRITE, CARGO_OPERATE, TRIP_WRITE, STAGE_OPERATE,
                ASSIGNMENT_WRITE, LOCATION_WRITE, FEED_WRITE, DELIVERY_OPERATE, DOCUMENT_MANAGE, DOCUMENT_REVIEW)));
        assertTrue(!maintainer.contains(FEED_ADMIN), "a feed's service account cannot change the feed's rules");
        assertTrue(!maintainer.contains(MONITOR_ADMIN), "a feed's service account cannot change the monitors");
    }

    @Test
    void theScopeCatalogCannotShadowAValidMonitorKey() throws ReflectiveOperationException {
        String path = OrgMonitorsResource.class.getMethod("scopeValues", String.class)
                .getAnnotation(jakarta.ws.rs.Path.class).value();
        assertFalse(path.substring(1).matches("[a-z0-9][a-z0-9-]*"),
                "the catalog must use a path that cannot also identify a monitor");
    }

    @Test
    void theOrganizationsOwnClientOperatesWithoutARole() {
        AccessRegistry registry = new AccessRegistry(List.of(new CoreAccessCatalog(), new TripsAccessCatalog()));
        Set<String> client = AccessRules.resolve(1L, "acme", Caller.client("acme-client"),
                new AccessRules.Facts(null, true, Set.of()), registry).permissions();
        assertTrue(client.containsAll(Set.of(VIEW, STAGE_OPERATE, CARGO_OPERATE, ASSIGNMENT_WRITE)));
        assertTrue(!client.contains(MANDATE_WRITE) && !client.contains(TRIP_WRITE));
        Set<String> member = AccessRules.resolve(1L, "acme", Caller.user("ana@example.com"),
                new AccessRules.Facts(BaseRole.MEMBER, false, Set.of()), registry).permissions();
        assertTrue(!member.contains(STAGE_OPERATE), "a member without a role gets no default");
    }

    private static Set<String> grant(AccessRegistry registry, String role) {
        return AccessRules.resolve(1L, "acme", Caller.user("ana@example.com"),
                new AccessRules.Facts(BaseRole.MEMBER, false, Set.of(role)), registry)
                .permissions();
    }

    private static boolean isEndpoint(Method method) {
        return method.isAnnotationPresent(GET.class) || method.isAnnotationPresent(POST.class)
                || method.isAnnotationPresent(PUT.class) || method.isAnnotationPresent(PATCH.class)
                || method.isAnnotationPresent(DELETE.class);
    }

    private static List<Class<?>> resources() {
        String pkg = OrgTripsResource.class.getPackageName();
        try (Stream<java.nio.file.Path> files = Files.list(
                java.nio.file.Path.of(OrgTripsResource.class.getResource("").toURI()))) {
            return files.map(f -> f.getFileName().toString())
                    .filter(n -> n.endsWith(".class") && !n.contains("$"))
                    .<Class<?>>map(n -> load(pkg + "." + n.substring(0, n.length() - ".class".length())))
                    .filter(c -> c.isAnnotationPresent(jakarta.ws.rs.Path.class)
                            && c != OrgTripsAccessResource.class)
                    .sorted(Comparator.comparing(Class::getSimpleName))
                    .toList();
        } catch (IOException | URISyntaxException e) {
            throw new IllegalStateException("cannot list " + pkg, e);
        }
    }

    private static Class<?> load(String name) {
        try {
            return Class.forName(name);
        } catch (ClassNotFoundException e) {
            throw new IllegalStateException(e);
        }
    }
}
