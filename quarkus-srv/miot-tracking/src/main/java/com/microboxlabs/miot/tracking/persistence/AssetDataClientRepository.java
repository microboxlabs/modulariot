package com.microboxlabs.miot.tracking.persistence;

import cl.streamhub.gps.model.EnvelopedMessage;
import io.smallrye.mutiny.Uni;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.SqlConnection;
import io.vertx.mutiny.sqlclient.Tuple;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import java.util.ArrayList;
import java.util.List;
import org.jboss.logging.Logger;

@ApplicationScoped
public class AssetDataClientRepository {

    private static final Logger logger = Logger.getLogger(AssetDataClientRepository.class);

    private static final String GET_CLIENT_MAPPINGS_QUERY = """
            SELECT shared_client_id
            FROM miot_tracking.asset_client_map
            WHERE asset_id = $1 AND active = true
            AND NOW() BETWEEN valid_from AND valid_to
            """;

    private static final String INSERT_CLIENT_QUERY = """
            INSERT INTO miot_tracking.asset_data_client (
            asset_data_id, asset_id, shared_client_id, timestamp)
            VALUES ($1, $2, $3, $4)
            """;

    private final Instance<Pool> clientInstance;

    AssetDataClientRepository(Instance<Pool> clientInstance) {
        this.clientInstance = clientInstance;
    }

    private Pool client() {
        return clientInstance.get();
    }

    public Uni<CrossReferenceResult> crossReferenceAndSave(EnvelopedMessage message, Long assetDataId) {
        String assetId = message.getPayload().getAssetId();

        return getClientMappings(assetId)
                .chain(clientMappings -> saveClientData(message, assetDataId, clientMappings)
                        .map(result -> new CrossReferenceResult(result, clientMappings)));
    }

    public Uni<List<String>> getClientMappings(String assetId) {
        return client().preparedQuery(GET_CLIENT_MAPPINGS_QUERY)
                .execute(Tuple.of(assetId))
                .onFailure()
                .invoke(failure -> logger.errorf(failure,
                        "Failed to get client mappings for assetId: %s. Error: %s",
                        assetId, failure.getMessage()))
                .map(rowSet -> {
                    List<String> clientIds = new ArrayList<>();
                    for (Row row : rowSet) {
                        clientIds.add(row.getString("shared_client_id"));
                    }
                    return clientIds;
                });
    }

    private Uni<String> saveClientData(EnvelopedMessage message, Long assetDataId,
            List<String> clientMappings) {
        var asset = message.getPayload();
        String assetId = asset.getAssetId();

        if (clientMappings.isEmpty()) {
            return Uni.createFrom().item(assetId);
        }

        return client().withTransaction((SqlConnection conn) -> {
            Uni<Void> chain = Uni.createFrom().voidItem();

            for (String clientId : clientMappings) {
                Tuple tuple = Tuple.from(new Object[]{
                        assetDataId,
                        assetId,
                        clientId,
                        asset.getTimestamp().toOffsetDateTime()
                });

                chain = chain.chain(() -> conn.preparedQuery(INSERT_CLIENT_QUERY).execute(tuple)
                        .onFailure()
                        .invoke(failure -> logger.errorf(failure,
                                "Failed to insert into asset_data_client - assetDataId: %d, assetId: %s, clientId: %s. Error: %s",
                                assetDataId, assetId, clientId, failure.getMessage()))
                        .replaceWithVoid());
            }

            return chain.map(v -> assetId);
        });
    }

    public static class CrossReferenceResult {
        private final String result;
        private final List<String> sharedClientIds;

        public CrossReferenceResult(String result, List<String> sharedClientIds) {
            this.result = result;
            this.sharedClientIds = sharedClientIds;
        }

        public String getResult() {
            return result;
        }

        public List<String> getSharedClientIds() {
            return sharedClientIds;
        }
    }
}
