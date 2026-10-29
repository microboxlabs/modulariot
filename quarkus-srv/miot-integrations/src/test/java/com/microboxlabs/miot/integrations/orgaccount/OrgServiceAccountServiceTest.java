package com.microboxlabs.miot.integrations.orgaccount;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Pattern;
import org.junit.jupiter.api.Test;

class OrgServiceAccountServiceTest {

    private static final String PROJECT = "tenants-p";
    private static final Pattern VALID_ID = Pattern.compile("[a-z][a-z0-9-]{4,28}[a-z0-9]");

    private static class MemoryRepository extends OrgServiceAccountRepository {
        final Map<String, OrgServiceAccount> rows = new HashMap<>();

        @Override
        public Optional<OrgServiceAccount> find(String tenantCode) {
            return Optional.ofNullable(rows.get(tenantCode));
        }

        @Override
        public OrgServiceAccount insert(OrgServiceAccount account) {
            rows.put(account.tenantCode(), account);
            return account;
        }

        @Override
        public OrgServiceAccount setDisabled(String tenantCode, boolean disabled, String actor) {
            OrgServiceAccount a = rows.get(tenantCode);
            OrgServiceAccount updated = new OrgServiceAccount(a.tenantCode(), a.projectId(), a.accountId(),
                    a.email(), a.uniqueId(), disabled, a.createdAt(), a.createdBy(), a.updatedAt(), actor);
            rows.put(tenantCode, updated);
            return updated;
        }
    }

    /** Google's side: accounts by id, each with its description. */
    private static class FakeIam extends GoogleIamClient {
        final Map<String, Account> accounts = new HashMap<>();
        final List<String> calls = new ArrayList<>();

        FakeIam() {
            super(null, null, () -> "unused");
        }

        @Override
        public Account create(String projectId, String accountId, String displayName, String description) {
            calls.add("create " + accountId);
            if (accounts.containsKey(accountId)) throw new GoogleCallException(409, "exists");
            Account account = new Account(email(accountId), "u-" + accountId, description, false);
            accounts.put(accountId, account);
            return account;
        }

        @Override
        public Optional<Account> find(String projectId, String email) {
            return accounts.values().stream().filter(a -> a.email().equals(email)).findFirst();
        }

        @Override
        public void disable(String projectId, String email) {
            calls.add("disable " + email);
        }

        @Override
        public void enable(String projectId, String email) {
            calls.add("enable " + email);
        }

        @Override
        public AccessToken impersonate(String email, List<String> scopes, Duration lifetime) {
            calls.add("impersonate " + email);
            return new AccessToken("secret-token", Instant.parse("2026-10-29T15:05:00Z"));
        }

        static String email(String accountId) {
            return accountId + "@" + PROJECT + ".iam.gserviceaccount.com";
        }
    }

    private final MemoryRepository repository = new MemoryRepository();
    private final FakeIam iam = new FakeIam();
    private final OrgServiceAccountService service =
            new OrgServiceAccountService(repository, iam, Optional.of(PROJECT), "t-");

    @Test
    void createsOneAccountPerOrganization() {
        OrgServiceAccount created = service.create("client-1", "acme", "Acme", "owner@example.com");
        assertEquals("t-acme", created.accountId());
        assertEquals("t-acme@tenants-p.iam.gserviceaccount.com", created.email());
        assertEquals("owner@example.com", created.createdBy());
        assertSame(created, service.create("client-1", "acme", "Acme", "owner@example.com"));
        assertEquals(List.of("create t-acme"), iam.calls);
    }

    @Test
    void adoptsItsOwnAccountLeftByAnEarlierAttempt() {
        iam.accounts.put("t-acme", new GoogleIamClient.Account(FakeIam.email("t-acme"), "u-1",
                OrgServiceAccountService.description("client-1"), false));
        assertEquals("t-acme", service.create("client-1", "acme", "Acme", "a").accountId());
    }

    @Test
    void neverTakesOverAnotherOrganizationsAccount() {
        iam.accounts.put("t-acme", new GoogleIamClient.Account(FakeIam.email("t-acme"), "u-1",
                OrgServiceAccountService.description("other-client"), false));
        OrgServiceAccount created = service.create("client-1", "acme", "Acme", "a");
        assertTrue(created.accountId().startsWith("t-acme-"));
        assertEquals(OrgServiceAccountService.description("client-1"),
                iam.accounts.get(created.accountId()).description());
    }

    @Test
    void refusesWhenNoProjectIsConfigured() {
        OrgServiceAccountService off = new OrgServiceAccountService(repository, iam, Optional.of(" "), "t-");
        assertFalse(off.configured());
        assertThrows(OrgServiceAccountService.NotConfiguredException.class,
                () -> off.create("client-1", "acme", "Acme", "a"));
    }

    @Test
    void accountIdsAreValidForAnySlug() {
        for (String slug : List.of("a", "acme", "exacta-01", "Mintral SpA", "--x--",
                "a-very-long-organization-slug-that-goes-on")) {
            List<String> ids = OrgServiceAccountService.accountIds("t-", slug, "tenant-" + slug);
            assertFalse(ids.isEmpty(), slug);
            for (String id : ids) assertTrue(VALID_ID.matcher(id).matches(), slug + " -> " + id);
        }
        assertEquals("t-mintral-spa", OrgServiceAccountService.accountIds("t-", "Mintral SpA", "c").get(0));
    }

    @Test
    void disablesAndEnablesInGoogleFirst() {
        service.create("client-1", "acme", "Acme", "a");
        assertTrue(service.setDisabled("client-1", true, "b").disabled());
        assertFalse(service.setDisabled("client-1", false, "b").disabled());
        assertEquals(List.of("create t-acme", "disable " + FakeIam.email("t-acme"),
                "enable " + FakeIam.email("t-acme")), iam.calls);
    }

    @Test
    void checkMintsATokenButDoesNotReturnIt() {
        service.create("client-1", "acme", "Acme", "a");
        OrgServiceAccountService.Check check = service.check("client-1");
        assertEquals(Instant.parse("2026-10-29T15:05:00Z"), check.tokenExpiresAt());
        assertFalse(check.toString().contains("secret-token"));
        service.setDisabled("client-1", true, "b");
        assertNull(service.check("client-1").tokenExpiresAt());
    }

    @Test
    void anOrganizationWithoutAnAccountIsNotFound() {
        assertThrows(OrgServiceAccountService.NotFoundException.class, () -> service.check("nobody"));
        assertThrows(OrgServiceAccountService.NotFoundException.class,
                () -> service.setDisabled("nobody", true, "a"));
    }
}
