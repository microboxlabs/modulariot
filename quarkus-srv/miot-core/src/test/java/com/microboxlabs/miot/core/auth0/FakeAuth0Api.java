package com.microboxlabs.miot.core.auth0;

import io.smallrye.mutiny.Uni;
import jakarta.ws.rs.WebApplicationException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Supplier;

/** An Auth0 tenant in memory. Checks the bearer token and records grants. */
public class FakeAuth0Api implements Auth0ManagementApi {

    static final String TOKEN = "mgmt-token";

    final Map<String, Client> clients = new LinkedHashMap<>();
    final List<ClientGrant> grants = new ArrayList<>();
    final AtomicInteger tokenCalls = new AtomicInteger();
    final List<Integer> pagesRead = new ArrayList<>();
    volatile boolean failGrants;

    public void failGrants(boolean fail) {
        failGrants = fail;
    }

    public synchronized void reset() {
        clients.clear();
        grants.clear();
        tokenCalls.set(0);
        pagesRead.clear();
        failGrants = false;
    }

    public synchronized void add(String clientId, String name, String appType) {
        clients.put(clientId, new Client(clientId, name, appType, "secret-" + clientId));
    }

    public synchronized Client client(String clientId) {
        return clients.get(clientId);
    }

    public synchronized int clientCount() {
        return clients.size();
    }

    public synchronized List<ClientGrant> grants() {
        return List.copyOf(grants);
    }

    @Override
    public Uni<TokenResponse> token(TokenRequest request) {
        tokenCalls.incrementAndGet();
        if (!"client_credentials".equals(request.grantType()) || !request.audience().endsWith("/api/v2/")) {
            return Uni.createFrom().failure(new WebApplicationException(401));
        }
        return Uni.createFrom().item(new TokenResponse(TOKEN, 86400));
    }

    @Override
    public synchronized Uni<Client> createClient(String authorization, NewClient client) {
        return authorized(authorization, () -> {
            String id = "cid" + UUID.randomUUID().toString().replace("-", "").substring(0, 20);
            Client created = new Client(id, client.name(), client.appType(), "secret-" + id);
            clients.put(id, created);
            return created;
        });
    }

    @Override
    public synchronized Uni<Void> deleteClient(String authorization, String clientId) {
        return authorized(authorization, () -> {
            clients.remove(clientId);
            return null;
        });
    }

    @Override
    public synchronized Uni<Client> client(String authorization, String clientId, String fields,
            boolean includeFields) {
        return authorized(authorization, () -> existing(clientId));
    }

    @Override
    public synchronized Uni<List<Client>> clients(String authorization, String appType, String fields,
            boolean includeFields, int page, int perPage) {
        return authorized(authorization, () -> {
            pagesRead.add(page);
            List<Client> all = new ArrayList<>(clients.values());
            int from = Math.min(page * perPage, all.size());
            return all.subList(from, Math.min(from + perPage, all.size())).stream()
                    .map(c -> new Client(c.clientId(), c.name(), c.appType(), null))
                    .toList();
        });
    }

    @Override
    public synchronized Uni<Client> rotateSecret(String authorization, String clientId) {
        return authorized(authorization, () -> {
            Client old = existing(clientId);
            Client rotated = new Client(clientId, old.name(), old.appType(), "rotated-" + UUID.randomUUID());
            clients.put(clientId, rotated);
            return rotated;
        });
    }

    @Override
    public synchronized Uni<Map<String, Object>> createGrant(String authorization, ClientGrant grant) {
        if (failGrants) {
            return Uni.createFrom().failure(new WebApplicationException(403));
        }
        return authorized(authorization, () -> {
            grants.add(grant);
            return Map.of("id", "grant-" + grant.clientId());
        });
    }

    private Client existing(String clientId) {
        Client client = clients.get(clientId);
        if (client == null) {
            throw new WebApplicationException(404);
        }
        return client;
    }

    private static <T> Uni<T> authorized(String authorization, Supplier<T> call) {
        if (!("Bearer " + TOKEN).equals(authorization)) {
            return Uni.createFrom().failure(new WebApplicationException(401));
        }
        return Uni.createFrom().item(call);
    }
}
