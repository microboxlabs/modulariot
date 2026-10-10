package com.microboxlabs.miot.symptoms.access;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.core.iam.AccessRegistry;
import com.microboxlabs.miot.core.iam.AccessRules;
import com.microboxlabs.miot.core.iam.BaseRole;
import com.microboxlabs.miot.core.iam.Caller;
import com.microboxlabs.miot.core.iam.CoreAccessCatalog;
import com.microboxlabs.miot.core.iam.OrgPermission;
import com.microboxlabs.miot.symptoms.api.OrgControlTowerAuditResource;
import com.microboxlabs.miot.symptoms.api.OrgControlTowerContactsResource;
import com.microboxlabs.miot.symptoms.api.OrgControlTowerMapResource;
import com.microboxlabs.miot.symptoms.api.OrgControlTowerSettingsResource;
import com.microboxlabs.miot.symptoms.api.OrgControlTowerTreatmentsResource;
import com.microboxlabs.miot.symptoms.api.OrgDataSourcesResource;
import com.microboxlabs.miot.symptoms.api.OrgSymptomDefinitionsResource;
import com.microboxlabs.miot.symptoms.api.OrgSymptomFamiliesResource;
import io.quarkus.security.PermissionsAllowed;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.PATCH;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import java.lang.reflect.Method;
import java.lang.reflect.Modifier;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import org.junit.jupiter.api.Test;

class ControlTowerPermissionsTest {

    private static final List<Class<?>> RESOURCES = List.of(OrgControlTowerAuditResource.class,
            OrgControlTowerContactsResource.class, OrgControlTowerMapResource.class, OrgControlTowerSettingsResource.class,
            OrgControlTowerTreatmentsResource.class, OrgDataSourcesResource.class,
            OrgSymptomDefinitionsResource.class, OrgSymptomFamiliesResource.class);

    private static final String VIEW = ControlTowerAccessCatalog.VIEW;
    private static final String TREAT = ControlTowerAccessCatalog.CASE_TREAT;
    private static final String CONTACT_WRITE = ControlTowerAccessCatalog.CONTACT_WRITE;
    private static final String CONTACT_DELETE = ControlTowerAccessCatalog.CONTACT_DELETE;
    private static final String EDIT = ControlTowerAccessCatalog.SYMPTOM_EDIT;
    private static final String PUBLISH = ControlTowerAccessCatalog.SYMPTOM_PUBLISH;
    private static final String SETTINGS = ControlTowerAccessCatalog.SETTINGS_UPDATE;

    /** Every endpoint and the permission it needs. A new endpoint without an entry here fails the test. */
    private static final Map<String, String> EXPECTED = new TreeMap<>(Map.ofEntries(
            Map.entry("OrgControlTowerAuditResource.list", VIEW),
            Map.entry("OrgControlTowerContactsResource.list", VIEW),
            Map.entry("OrgControlTowerContactsResource.get", VIEW),
            Map.entry("OrgControlTowerContactsResource.create", CONTACT_WRITE),
            Map.entry("OrgControlTowerContactsResource.importContacts", CONTACT_WRITE),
            Map.entry("OrgControlTowerContactsResource.update", CONTACT_WRITE),
            Map.entry("OrgControlTowerContactsResource.delete", CONTACT_DELETE),
            Map.entry("OrgControlTowerMapResource.positions", VIEW),
            Map.entry("OrgControlTowerMapResource.summary", VIEW),
            Map.entry("OrgControlTowerMapResource.conditions", VIEW),
            Map.entry("OrgControlTowerMapResource.symptoms", VIEW),
            Map.entry("OrgControlTowerSettingsResource.get", VIEW),
            Map.entry("OrgControlTowerSettingsResource.save", SETTINGS),
            Map.entry("OrgControlTowerTreatmentsResource.listForSymptom", VIEW),
            Map.entry("OrgControlTowerTreatmentsResource.get", VIEW),
            Map.entry("OrgControlTowerTreatmentsResource.open", TREAT),
            Map.entry("OrgControlTowerTreatmentsResource.addAction", TREAT),
            Map.entry("OrgControlTowerTreatmentsResource.close", TREAT),
            Map.entry("OrgControlTowerTreatmentsResource.cancel", TREAT),
            Map.entry("OrgDataSourcesResource.list", VIEW),
            Map.entry("OrgDataSourcesResource.get", VIEW),
            Map.entry("OrgSymptomDefinitionsResource.stats", VIEW),
            Map.entry("OrgSymptomDefinitionsResource.describe", VIEW),
            Map.entry("OrgSymptomDefinitionsResource.list", VIEW),
            Map.entry("OrgSymptomDefinitionsResource.templates", VIEW),
            Map.entry("OrgSymptomDefinitionsResource.levelResponse", VIEW),
            Map.entry("OrgSymptomDefinitionsResource.get", VIEW),
            Map.entry("OrgSymptomDefinitionsResource.validate", VIEW),
            Map.entry("OrgSymptomDefinitionsResource.preview", VIEW),
            Map.entry("OrgSymptomDefinitionsResource.plan", VIEW),
            Map.entry("OrgSymptomDefinitionsResource.compare", VIEW),
            Map.entry("OrgSymptomDefinitionsResource.importEngine", EDIT),
            Map.entry("OrgSymptomDefinitionsResource.fromTemplate", EDIT),
            Map.entry("OrgSymptomDefinitionsResource.create", EDIT),
            Map.entry("OrgSymptomDefinitionsResource.updateIdentity", EDIT),
            Map.entry("OrgSymptomDefinitionsResource.saveDraft", EDIT),
            Map.entry("OrgSymptomDefinitionsResource.discardDraft", EDIT),
            Map.entry("OrgSymptomDefinitionsResource.fork", EDIT),
            Map.entry("OrgSymptomDefinitionsResource.publish", PUBLISH),
            Map.entry("OrgSymptomDefinitionsResource.rollback", PUBLISH),
            Map.entry("OrgSymptomDefinitionsResource.setState", PUBLISH),
            Map.entry("OrgSymptomFamiliesResource.list", VIEW)));

    @Test
    void everyEndpointDeclaresItsOrganizationPermission() {
        Map<String, String> actual = new TreeMap<>();
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
                assertEquals(1, allowed.value().length, name);
                actual.put(name, allowed.value()[0]);
            }
        }
        assertEquals(EXPECTED, actual);
    }

    @Test
    void eachRoleCanDoWhatItsNameSays() {
        AccessRegistry registry = new AccessRegistry(List.of(new CoreAccessCatalog(), new ControlTowerAccessCatalog()));
        Set<String> viewer = grant(registry, ControlTowerAccessCatalog.VIEWER);
        Set<String> operator = grant(registry, ControlTowerAccessCatalog.OPERATOR);
        Set<String> maintainer = grant(registry, ControlTowerAccessCatalog.MAINTAINER);

        assertTrue(viewer.contains(VIEW) && !viewer.contains(TREAT));
        assertTrue(operator.containsAll(Set.of(VIEW, TREAT, CONTACT_WRITE)) && !operator.contains(EDIT));
        assertTrue(maintainer.containsAll(Set.of(VIEW, TREAT, CONTACT_WRITE, CONTACT_DELETE, EDIT, PUBLISH,
                SETTINGS)));
    }

    @Test
    void anAlfrescoMemberWithoutARoleOperatesAsBefore() {
        AccessRegistry registry = new AccessRegistry(List.of(new CoreAccessCatalog(), new ControlTowerAccessCatalog()));
        Set<String> member = AccessRules.resolve(1L, "acme", Caller.user("ana@example.com"),
                new AccessRules.Facts(false, null, true, false, false, Set.of(), null), registry).permissions();
        assertTrue(member.contains(TREAT));
        assertTrue(!member.contains(EDIT));
    }

    private static Set<String> grant(AccessRegistry registry, String role) {
        return AccessRules.resolve(1L, "acme", Caller.user("ana@example.com"),
                new AccessRules.Facts(true, BaseRole.MEMBER, false, false, false, Set.of(role), null), registry)
                .permissions();
    }

    private static boolean isEndpoint(Method method) {
        return method.isAnnotationPresent(GET.class) || method.isAnnotationPresent(POST.class)
                || method.isAnnotationPresent(PUT.class) || method.isAnnotationPresent(PATCH.class)
                || method.isAnnotationPresent(DELETE.class);
    }
}
